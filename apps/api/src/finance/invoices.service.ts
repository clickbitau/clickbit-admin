import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, document_type_enum } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email.service';
import {
  asDocumentType,
  asJsonInput,
  buildInvoiceListEnvelope,
  buildLegacyMessageEnvelope,
  invoiceInclude,
  mapInvoice,
  parseDateOnly,
  parseLineItems,
  parseNumber,
} from './finance-utils';
import { PublicInvoicesService } from './public-invoices.service';
import { CacheService } from '../redis/cache.service';

function statusTransitionValid(from: string | null | undefined, to: string): { valid: boolean; message?: string } {
  if (!from || from === to) return { valid: true };
  if (from === 'paid' && to !== 'paid') return { valid: false, message: 'Paid invoice cannot change status' };
  if (from === 'cancelled' && to !== 'cancelled') return { valid: false, message: 'Cancelled invoice cannot change status' };
  return { valid: true };
}

function calculateTotals(items: { quantity: number; unit_price: number }[], taxType: string, taxRate: number, discount: number, discountType: string) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const actualDiscount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
  const discountedSubtotal = Math.max(0, subtotal - actualDiscount);
  let taxAmount = 0;
  let total = discountedSubtotal;

  if (taxType === 'gst_calculated') {
    taxAmount = discountedSubtotal * (taxRate / 100);
    total = discountedSubtotal + taxAmount;
  } else if (taxType === 'gst_included') {
    taxAmount = subtotal * (taxRate / 100);
    total = discountedSubtotal;
  }

  return { subtotal, taxAmount, total, actualDiscount };
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicInvoicesService: PublicInvoicesService,
    private readonly emailService: EmailService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('invoices', ...parts) ?? `invoices:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private get invoices() {
    return this.prisma.invoices;
  }

  private async generateInvoiceNumber(type: string) {
    const year = new Date().getFullYear();
    const prefixMap: Record<string, string> = {
      invoice: `INV-${year}-`,
      estimate: `EST-${year}-`,
      quote: `QTE-${year}-`,
      package: `PKG-${year}-`,
    };
    const prefix = prefixMap[type] || prefixMap.invoice;
    const count = await this.invoices.count({ where: { package_code: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  private normalizedItems(items: unknown) {
    return parseLineItems(items).map((item) => ({
      name: item.name,
      description: item.description || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    }));
  }

  private async recalcInvoicePaymentStatus(invoiceId: number) {
    const invoice = await this.invoices.findUnique({ where: { id: invoiceId } });
    if (!invoice) return;

    const result = await this.prisma.payments.aggregate({
      where: { invoice_id: invoiceId, deleted_at: null, status: 'completed' },
      _sum: { amount: true },
    });
    const paid = parseNumber(result._sum.amount);
    const total = parseNumber(invoice.total_amount);

    let status = invoice.status;
    let paidAt = invoice.paid_at;
    if (paid >= total) {
      status = 'paid';
      paidAt = paidAt || new Date();
    } else if (paid > 0) {
      status = 'partial';
      paidAt = null;
    } else {
      status = invoice.status === 'paid' || invoice.status === 'partial' ? 'sent' : invoice.status;
      paidAt = null;
    }

    await this.invoices.update({
      where: { id: invoiceId },
      data: { amount_paid: paid, status, paid_at: paidAt },
    });
  }

  private async ensureContactAndCompany(dto: Record<string, unknown>, userId: number) {
    let contactId: number | undefined = dto.source_id ? Number(dto.source_id) : undefined;
    let companyId: number | undefined;

    const clientEmail = ((dto.client_email as string) || '').trim();
    const clientName = ((dto.client_name as string) || '').trim();
    const clientCompany = ((dto.client_company as string) || '').trim();

    if (!contactId && clientEmail) {
      const existing = await this.prisma.contacts.findFirst({
        where: { email: clientEmail, deleted_at: null },
        orderBy: { created_at: 'desc' },
        select: { id: true },
      });
      if (existing) {
        contactId = existing.id;
      } else {
        const created = await this.prisma.contacts.create({
          data: {
            name: clientName || clientCompany || 'Unknown',
            email: clientEmail,
            phone: (dto.client_phone as string) || null,
            company: clientCompany || null,
            subject: `Invoice: ${(dto.title as string) || 'Custom Package'}`,
            message: `Invoice created for ${clientName || clientCompany || 'customer'}`,
            contact_type: 'sales',
            priority: 'medium',
            status: 'resolved',
            lifecycle_stage: 'customer',
            lead_status: 'connected',
            custom_fields: JSON.stringify({ source: 'invoice_manual', invoice_count: 1, total_revenue: 0 }),
            owner_id: userId,
          },
          select: { id: true },
        });
        contactId = created.id;
      }
    }

    if (clientCompany) {
      const existingCompany = await this.prisma.companies.findFirst({
        where: { name: clientCompany, deleted_at: null },
        select: { id: true },
      });
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const created = await this.prisma.companies.create({
          data: {
            name: clientCompany,
            email: clientEmail || null,
            phone: (dto.client_phone as string) || null,
            lifecycle_stage: 'customer',
            owner_id: userId,
            custom_fields: JSON.stringify({ source: 'invoice_manual', invoice_count: 1, total_revenue: 0 }),
          },
          select: { id: true },
        });
        companyId = created.id;
      }

      if (contactId && companyId) {
        const existingLink = await this.prisma.crm_contact_companies.findFirst({
          where: { contact_id: contactId, company_id: companyId },
        });
        if (!existingLink) {
          await this.prisma.crm_contact_companies.create({
            data: { contact_id: contactId, company_id: companyId, is_primary: true },
          });
        }
      }
    }

    return { contactId, companyId };
  }

  private buildCreateData(dto: Record<string, unknown>, userId: number, contactId?: number, companyId?: number): Prisma.invoicesUncheckedCreateInput {
    const items = this.normalizedItems(dto.items);
    const taxType = (dto.tax_type as string) || 'gst_included';
    const taxRate = parseNumber(dto.tax_rate) || 10;
    const discount = Math.max(0, parseNumber(dto.discount_amount));
    const discountType = (dto.discount_type as string) || 'amount';
    const { subtotal, taxAmount, total, actualDiscount } = calculateTotals(items, taxType, taxRate, discount, discountType);

    const docType = (asDocumentType((dto.document_type as string) || (dto.type as string) || 'invoice') || 'invoice') as Prisma.invoicesUncheckedCreateInput['document_type'];
    const title = ((dto.title as string) || `Invoice for ${(dto.client_name as string) || (dto.client_company as string) || 'Customer'}`).replace(/^project:\s*/i, '').trim();

    return {
      package_code: dto.package_code as string,
      client_name: (dto.client_name as string) || (dto.client_company as string) || 'Customer',
      client_email: (dto.client_email as string) || '',
      client_phone: (dto.client_phone as string) || null,
      client_company: (dto.client_company as string) || null,
      title,
      description: (dto.description as string) || null,
      line_items: asJsonInput(items) ?? [],
      items: asJsonInput(items) ?? [],
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      discount_amount: actualDiscount,
      total_amount: total,
      amount_paid: 0,
      amount_due: total,
      currency: (dto.currency as string) || 'AUD',
      status: (dto.status as string) || 'draft',
      valid_until: parseDateOnly(dto.valid_until as string) || null,
      terms: (dto.terms as string) || null,
      notes: (dto.notes as string) || null,
      client_notes: (dto.client_notes as string) || null,
      tax_type: taxType,
      template_type: (dto.template_type as string) || 'tax_excluded',
      issue_date: parseDateOnly(dto.issue_date as string) || new Date(),
      document_type: docType,
      source_type: (dto.source_type as string) || (contactId ? 'contact' : null),
      source_id: contactId || (dto.source_id ? Number(dto.source_id) : null),
      contact_id: contactId || null,
      company_id: companyId || null,
      crm_project_id: dto.crm_project_id ? Number(dto.crm_project_id) : null,
      crm_subproject_id: dto.crm_subproject_id ? Number(dto.crm_subproject_id) : null,
      created_by: userId,
      payment_status: 'pending',
      exchange_rate: 1,
    };
  }

  private buildUpdateData(invoice: Record<string, unknown>, dto: Record<string, unknown>) {
    const updates: Prisma.invoicesUncheckedUpdateInput = {};

    if (dto.client_name !== undefined) updates.client_name = (dto.client_name as string) || '';
    if (dto.client_email !== undefined) updates.client_email = (dto.client_email as string) || '';
    if (dto.client_phone !== undefined) updates.client_phone = (dto.client_phone) || null;
    if (dto.client_company !== undefined) updates.client_company = (dto.client_company) || null;
    if (dto.title !== undefined) updates.title = ((dto.title as string) || '').replace(/^project:\s*/i, '').trim();
    if (dto.description !== undefined) updates.description = (dto.description) || null;
    if (dto.terms !== undefined) updates.terms = (dto.terms) || null;
    if (dto.notes !== undefined) updates.notes = (dto.notes) || null;
    if (dto.client_notes !== undefined) updates.client_notes = (dto.client_notes) || null;
    if (dto.valid_until !== undefined) updates.valid_until = parseDateOnly(dto.valid_until as string) || null;
    if (dto.issue_date !== undefined) updates.issue_date = parseDateOnly(dto.issue_date as string) || null;
    if (dto.crm_project_id !== undefined) updates.crm_project_id = dto.crm_project_id ? Number(dto.crm_project_id) : null;
    if (dto.crm_subproject_id !== undefined) updates.crm_subproject_id = dto.crm_subproject_id ? Number(dto.crm_subproject_id) : null;

    const resolvedType = (dto.document_type as string) || (dto.type as string);
    if (resolvedType) updates.document_type = (asDocumentType(resolvedType) || 'invoice');

    if (dto.status !== undefined && dto.status !== invoice.status) {
      const validation = statusTransitionValid(invoice.status as string, dto.status as string);
      if (!validation.valid) throw new BadRequestException({ message: validation.message });
      updates.status = dto.status;
    }

    const items = dto.items !== undefined ? this.normalizedItems(dto.items) : undefined;
    const taxType = (dto.tax_type as string) || undefined;
    const taxRate = dto.tax_rate !== undefined ? parseNumber(dto.tax_rate) : undefined;
    const discountAmount = dto.discount_amount !== undefined ? parseNumber(dto.discount_amount) : undefined;
    const discountType = (dto.discount_type as string) || undefined;

    if (items !== undefined || taxType !== undefined || taxRate !== undefined || discountAmount !== undefined || discountType !== undefined) {
      const existingItems = items || (parseLineItems(invoice.line_items));
      const existingTaxType = (taxType || (invoice.tax_type as string) || 'gst_included');
      const existingTaxRate = taxRate !== undefined ? taxRate : parseNumber(invoice.tax_rate) || 10;
      const existingDiscount = discountAmount !== undefined ? discountAmount : parseNumber(invoice.discount_amount) || 0;
      const existingDiscountType = discountType || (invoice.discount_type as string) || 'amount';
      const { subtotal, taxAmount, total, actualDiscount } = calculateTotals(existingItems, existingTaxType, existingTaxRate, existingDiscount, existingDiscountType);

      updates.line_items = asJsonInput(existingItems) ?? [];
      updates.items = asJsonInput(existingItems) ?? [];
      updates.subtotal = subtotal;
      updates.tax_amount = taxAmount;
      updates.tax_rate = existingTaxRate;
      updates.tax_type = existingTaxType;
      updates.discount_amount = actualDiscount;
      updates.discount_value = actualDiscount;
      updates.total_amount = total;
      updates.amount_due = Math.max(0, total - parseNumber(invoice.amount_paid));
    }

    return updates;
  }

  async getStats() {
    const rows = await this.invoices.findMany({
      where: { deleted_at: null },
      select: {
        status: true,
        document_type: true,
        total_amount: true,
        amount_paid: true,
        amount_due: true,
        valid_until: true,
        due_date: true,
      },
    });

    const stats: Record<string, number> = {
      total: 0,
      draft: 0,
      sent: 0,
      viewed: 0,
      partial: 0,
      paid: 0,
      cancelled: 0,
      expired: 0,
      overdue: 0,
      totalAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      overdueAmount: 0,
      draftAmount: 0,
      sentAmount: 0,
      viewedAmount: 0,
      partialAmount: 0,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isOverdue = (row: { valid_until?: Date | null; due_date?: Date | null }) => {
      if (row.valid_until && new Date(row.valid_until) < today) return true;
      if (row.due_date && new Date(row.due_date) < today) return true;
      return false;
    };

    for (const row of rows) {
      const key = row.status || 'unknown';
      if (stats[key] !== undefined) stats[key] = (stats[key] || 0) + 1;
      stats.total += 1;

      const total = parseNumber(row.total_amount);
      const paid = parseNumber(row.amount_paid);
      const due = parseNumber(row.amount_due);

      stats.totalAmount += total;
      if (row.status === 'paid') stats.paidAmount += total;
      if (row.status === 'partial') stats.paidAmount += paid;
      if (['sent', 'viewed', 'partial'].includes(row.status || '')) stats.outstandingAmount += due;
      if (row.status === 'draft') stats.draftAmount += total;
      if (row.status === 'sent') stats.sentAmount += total;
      if (row.status === 'viewed') stats.viewedAmount += total;
      if (row.status === 'partial') stats.partialAmount += total;

      if (['sent', 'viewed', 'partial'].includes(row.status || '') && isOverdue(row)) {
        stats.overdue += 1;
        stats.overdueAmount += due;
      }
    }

    stats.expired = stats.overdue;

    return stats;
  }

  async findAll(query: Record<string, unknown>) {
    const cacheKey = this.cacheKey('list', JSON.stringify(query));
    return this.cache?.getOrSet(cacheKey, () => this.fetchFindAll(query), this.CACHE_TTL_SECONDS) ?? this.fetchFindAll(query);
  }

  private async fetchFindAll(query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(250, Math.max(1, Number(query.limit ?? 10)));
    const sortBy = (query.sort_by as string) || 'created_at';
    const sortOrder = ((query.sort_order as string) || 'DESC').toUpperCase() === 'ASC' ? 'asc' : 'desc';

    const where: Prisma.invoicesWhereInput = { deleted_at: null, is_demo: false };
    const andFilters: Prisma.invoicesWhereInput[] = [];
    if (String(query.include_demo).toLowerCase() !== 'true') {
      andFilters.push({
        OR: [{ company_id: null }, { companies: { is_demo: false } }],
      });
    }

    const status = query.status as string | undefined;
    if (status) {
      if (status === 'overdue') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        andFilters.push({
          status: { in: ['sent', 'viewed', 'partial'] },
        });
        andFilters.push({
          OR: [
            { valid_until: { lt: today } },
            { due_date: { lt: today } },
          ],
        });
      } else if (status.includes(',')) {
        where.status = { in: status.split(',') };
      } else {
        where.status = status;
      }
    }

    const docType = (query.type as string) || (query.document_type as string);
    if (docType) where.document_type = docType as document_type_enum;

    if (query.customer) {
      const customerId = Number(query.customer);
      andFilters.push({ OR: [{ source_id: customerId }, { contact_id: customerId }] });
    }

    const search = (query.search as string)?.trim();
    if (search) {
      andFilters.push({
        OR: [
          { client_name: { contains: search, mode: 'insensitive' } },
          { client_email: { contains: search, mode: 'insensitive' } },
          { client_company: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { package_code: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (andFilters.length) where.AND = andFilters;

    const fieldMap: Record<string, string> = { invoice_number: 'package_code', total: 'total_amount' };
    let orderBy: Prisma.invoicesOrderByWithRelationInput | Prisma.invoicesOrderByWithRelationInput[] = {};
    const allowedSortFields = new Set(['created_at', 'updated_at', 'title', 'client_name', 'total_amount', 'status', 'valid_until', 'package_code', 'issue_date']);
    const sortField = allowedSortFields.has(sortBy) ? (fieldMap[sortBy] || sortBy) : 'created_at';

    if (sortField === 'issue_date') {
      orderBy = [{ issue_date: { sort: sortOrder, nulls: 'last' } }, { created_at: sortOrder }];
    } else {
      orderBy = { [sortField]: sortOrder };
    }

    const [total, rows] = await Promise.all([
      this.invoices.count({ where }),
      this.invoices.findMany({
        where,
        include: invoiceInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return buildInvoiceListEnvelope(rows, total, page, limit);
  }

  async findOne(id: number) {
    const cacheKey = this.cacheKey('detail', id);
    return this.cache?.getOrSet(cacheKey, () => this.fetchFindOne(id), this.CACHE_TTL_SECONDS) ?? this.fetchFindOne(id);
  }

  private async fetchFindOne(id: number) {
    const invoice = await this.invoices.findUnique({ where: { id, deleted_at: null }, include: invoiceInclude });
    if (!invoice) throw new NotFoundException({ success: false, message: 'Invoice not found' });
    return { success: true, data: mapInvoice(invoice, true) };
  }

  async create(userId: number, dto: Record<string, unknown>) {
    if (!(dto.client_name as string)?.trim() && !(dto.client_company as string)?.trim()) {
      throw new BadRequestException({ message: 'Either client name or company must be provided' });
    }
    if (!(dto.client_email as string)?.trim()) {
      throw new BadRequestException({ message: 'Client email is required' });
    }
    const items = this.normalizedItems(dto.items);
    if (!items.length) throw new BadRequestException({ message: 'At least one line item is required' });
    if (items.some((i) => !i.name?.trim())) throw new BadRequestException({ message: 'Each line item must have a name' });

    const validStatuses = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'];
    if (dto.status && !validStatuses.includes(dto.status as string)) {
      throw new BadRequestException({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const { contactId, companyId } = await this.ensureContactAndCompany(dto, userId);
    const packageCode = await this.generateInvoiceNumber((dto.document_type as string) || (dto.type as string) || 'invoice');
    dto.package_code = packageCode;

    const data = this.buildCreateData(dto, userId, contactId, companyId);
    const invoice = await this.invoices.create({ data, include: invoiceInclude });
    await this.invalidateCache();
    return mapInvoice(invoice);
  }

  async update(id: number, dto: Record<string, unknown>) {
    const invoice = await this.invoices.findUnique({ where: { id, deleted_at: null } });
    if (!invoice) throw new NotFoundException({ message: 'Invoice not found' });

    const updates = this.buildUpdateData(invoice, dto);
    const updated = await this.invoices.update({ where: { id }, data: updates, include: invoiceInclude });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return mapInvoice(updated);
  }

  async remove(id: number) {
    const invoice = await this.invoices.findUnique({ where: { id, deleted_at: null } });
    if (!invoice) throw new NotFoundException({ message: 'Invoice not found' });
    if (invoice.status === 'paid') throw new BadRequestException({ message: 'Cannot delete a paid invoice' });

    await this.invoices.update({ where: { id }, data: { deleted_at: new Date() } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Invoice deleted successfully' };
  }

  async void(id: number, userEmail?: string) {
    const invoice = await this.invoices.findUnique({ where: { id, deleted_at: null } });
    if (!invoice) throw new NotFoundException({ success: false, message: 'Invoice not found' });
    if (invoice.status === 'paid') throw new BadRequestException({ success: false, message: 'Cannot void a paid invoice. Please refund any payments first.' });
    if (invoice.status === 'cancelled') throw new BadRequestException({ success: false, message: 'Invoice is already voided/cancelled' });

    const note = `[VOIDED on ${new Date().toISOString().split('T')[0]} by ${userEmail || 'Unknown'}]`;
    const updated = await this.invoices.update({
      where: { id },
      data: { status: 'cancelled', notes: `${(invoice.notes || '')}\n\n${note}`.trim() },
      include: invoiceInclude,
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Invoice voided successfully', { id: updated.id, package_code: updated.package_code, status: updated.status });
  }

  async send(id: number, origin?: string, _userEmail?: string) {
    const invoice = await this.invoices.findUnique({ where: { id, deleted_at: null } });
    if (!invoice) throw new NotFoundException({ message: 'Invoice not found' });

    const token = invoice.token || randomUUID();
    const defaultValidUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const updated = await this.invoices.update({
      where: { id },
      data: {
        status: 'sent',
        sent_at: new Date(),
        sent_count: { increment: 1 },
        token,
        valid_until: invoice.valid_until || defaultValidUntil,
        updated_at: new Date(),
      },
      include: invoiceInclude,
    });

    const { buffer } = await this.publicInvoicesService.generatePdf(updated.id);
    const emailResult = await this.emailService.sendInvoiceEmail(mapInvoice(updated, true), buffer, origin);

    const frontendUrl = process.env.FRONTEND_URL || origin || 'https://clickbit.com.au';
    const tokenParam = updated.token ? `?token=${updated.token}` : '';
    const paymentUrl = `${frontendUrl}/pay/${updated.package_code}${tokenParam}`;

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return {
      message: 'Invoice sent successfully',
      sent: emailResult.sent,
      paymentUrl,
      package: mapInvoice(updated, true),
      emailError: emailResult.error,
    };
  }

  async markPaid(id: number, userId: number) {
    const invoice = await this.invoices.findUnique({ where: { id, deleted_at: null } });
    if (!invoice) throw new NotFoundException({ message: 'Invoice not found' });
    if (invoice.status === 'paid') throw new BadRequestException({ message: 'Invoice is already marked as paid' });

    const total = parseNumber(invoice.total_amount);
    const payment = await this.prisma.payments.create({
      data: {
        invoice_id: invoice.id,
        amount: total,
        currency: invoice.currency || 'AUD',
        payment_provider: 'manual',
        payment_method: 'manual',
        transaction_id: `MANUAL-${invoice.id}-${Date.now()}`,
        status: 'completed',
        payment_date: new Date(),
        gateway_response: JSON.stringify({ marked_by: userId, marked_at: new Date() }),
        created_by: userId,
      },
    });

    await this.recalcInvoicePaymentStatus(invoice.id);
    const updated = await this.invoices.findUnique({ where: { id }, include: invoiceInclude });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Package marked as paid', package: mapInvoice(updated!), payment };
  }

  async recordPayment(id: number, userId: number, dto: Record<string, unknown>) {
    const invoice = await this.invoices.findUnique({ where: { id, deleted_at: null } });
    if (!invoice) throw new NotFoundException({ success: false, message: 'Package not found' });

    const paymentAmount = parseNumber(dto.amount);
    if (!paymentAmount || paymentAmount <= 0) throw new BadRequestException({ success: false, message: 'Valid payment amount is required' });

    const recentDuplicate = await this.prisma.payments.findFirst({
      where: { invoice_id: id, amount: paymentAmount, status: 'completed', created_at: { gte: new Date(Date.now() - 30000) } },
    });
    if (recentDuplicate) {
      throw new BadRequestException({ success: false, message: 'A payment for this amount was just recorded. Please wait before trying again.' });
    }

    const reference = (dto.reference as string)?.trim();
    const transactionId = reference
      ? `${reference}-${id}-${Date.now()}`
      : `PAYMENT-${id}-${Date.now()}`;

    const payment = await this.prisma.payments.create({
      data: {
        invoice_id: id,
        amount: paymentAmount,
        currency: invoice.currency || 'AUD',
        payment_provider: 'manual',
        payment_method: (dto.method as string) || 'bank_transfer',
        transaction_id: transactionId,
        status: 'completed',
        payment_date: new Date(),
        notes: (dto.notes as string) || null,
        gateway_response: JSON.stringify({ recorded_by: userId, recorded_at: new Date(), original_reference: (dto.reference as string) || null }),
        created_by: userId,
      },
    });

    await this.recalcInvoicePaymentStatus(id);
    const updated = await this.invoices.findUnique({ where: { id }, include: invoiceInclude });
    const total = parseNumber(invoice.total_amount);
    const paidSoFar = parseNumber(updated?.amount_paid) || 0;

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return {
      success: true,
      message: 'Payment recorded successfully',
      data: mapInvoice(updated!),
      payment,
      creditBalance: total - paidSoFar < 0 ? Math.abs(total - paidSoFar) : 0,
    };
  }

  async recalculatePayments(id: number) {
    const invoice = await this.invoices.findUnique({ where: { id, deleted_at: null } });
    if (!invoice) throw new NotFoundException({ message: 'Invoice not found' });

    await this.recalcInvoicePaymentStatus(id);
    const updated = await this.invoices.findUnique({ where: { id }, include: invoiceInclude });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Payment status recalculated', mapInvoice(updated!));
  }

  async recalculateAllPayments() {
    const rows = await this.invoices.findMany({ where: { deleted_at: null, document_type: 'invoice' }, select: { id: true } });
    let updated = 0;
    const errors: { invoice_id: number; invoice_number: string; error: string }[] = [];

    for (const row of rows) {
      try {
        await this.recalcInvoicePaymentStatus(row.id);
        updated++;
      } catch (error) {
        const inv = await this.invoices.findUnique({ where: { id: row.id }, select: { package_code: true } });
        errors.push({ invoice_id: row.id, invoice_number: inv?.package_code || '', error: (error as Error).message });
      }
    }

    await this.invalidateCache();
    return {
      success: true,
      message: `Recalculated payment status for ${updated} invoices`,
      updated,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async createFromContact(userId: number, contactId: number) {
    const contact = await this.prisma.contacts.findUnique({ where: { id: contactId, deleted_at: null } });
    if (!contact) throw new NotFoundException({ message: 'Contact not found' });

    const customFields = JSON.parse((contact.custom_fields as string) || '{}') as Record<string, any>;
    const items: any[] = [];
    const selectedServices = customFields.selectedServices || {};
    for (const [serviceId, service] of Object.entries(selectedServices)) {
      if (service && typeof service === 'object') {
        items.push({
          name: (service as any).name || (service as any).serviceName || `Service ${serviceId}`,
          description: (service as any).description || '',
          quantity: 1,
          unit_price: parseFloat((service as any).price) || 0,
          total: parseFloat((service as any).price) || 0,
        });
      }
    }
    const selectedFeatures = customFields.selectedFeatures || {};
    for (const [_serviceId, features] of Object.entries(selectedFeatures)) {
      if (features && typeof features === 'object') {
        for (const [featureId, feature] of Object.entries(features as any)) {
          if (feature && typeof feature === 'object') {
            items.push({
              name: (feature as any).name || (feature as any).featureName || `Feature ${featureId}`,
              description: (feature as any).description || '',
              quantity: 1,
              unit_price: parseFloat((feature as any).price) || 0,
              total: parseFloat((feature as any).price) || 0,
            });
          }
        }
      }
    }
    if (items.length === 0) {
      items.push({ name: 'Custom Services', description: 'Services to be specified', quantity: 1, unit_price: 0, total: 0 });
    }

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxRate = 10;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const projectName = customFields.projectName || '';
    const projectDescription = customFields.projectDescription || '';
    const budget = customFields.budget || '';
    const clientNotes = [
      projectName ? `Project: ${projectName}` : '',
      projectDescription ? `Description: ${projectDescription}` : '',
      customFields.businessObjectives ? `Objectives: ${customFields.businessObjectives}` : '',
      customFields.targetAudience ? `Target Audience: ${customFields.targetAudience}` : '',
      budget ? `Budget: ${budget}` : '',
      customFields.startDate ? `Start Date: ${customFields.startDate}` : '',
      customFields.endDate ? `End Date: ${customFields.endDate}` : '',
      customFields.milestones ? `Milestones: ${customFields.milestones}` : '',
      customFields.projectConstraints ? `Constraints: ${customFields.projectConstraints}` : '',
      customFields.futureExpansion ? `Future Plans: ${customFields.futureExpansion}` : '',
    ].filter(Boolean).join('\n');

    const title = projectName ? `${projectName.replace(/^project:\s*/i, '').trim()} - Custom Package` : `Custom Package for ${contact.name}`;

    const dto = {
      source_id: contact.id,
      source_type: 'contact',
      client_name: customFields.clientName || customFields.primaryContact || contact.name || 'Customer',
      client_email: customFields.email || contact.email || '',
      client_phone: customFields.contactNumber || contact.phone || null,
      client_company: customFields.companyName || contact.company || null,
      title,
      description: projectDescription || contact.subject || 'Custom service package based on project requirements',
      client_notes: clientNotes || contact.message || null,
      notes: `Created from Power Your Project form submission (Contact ID: ${contact.id})`,
      items,
      line_items: items,
      tax_type: 'gst_calculated',
      tax_rate: taxRate,
      tax_amount: taxAmount,
      subtotal,
      total_amount: total,
      amount_due: total,
      currency: 'AUD',
      status: 'draft',
      document_type: 'invoice',
      issue_date: new Date().toISOString().split('T')[0],
    };

    const created = await this.create(userId, dto);
    return { success: true, package: created };
  }

  async recoverStripePayment(id: number) {
    return this.publicInvoicesService.recoverStripePayment(id);
  }

  async recoverStripeByClient(dto: { client_name: string }) {
    return this.publicInvoicesService.recoverStripeByClientName(dto.client_name);
  }
}
