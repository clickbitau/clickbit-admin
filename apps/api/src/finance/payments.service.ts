import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { buildLegacyMessageEnvelope, mapPayment, parseNumber, safeDate } from './finance-utils';
import { CacheService } from '../redis/cache.service';

const paymentInclude = {
  invoices: {
    select: {
      id: true,
      package_code: true,
      title: true,
      client_name: true,
      client_company: true,
      total_amount: true,
      currency: true,
    },
  },
  crm_projects: { select: { id: true, name: true, project_number: true } },
} as const;

type PaymentWithRelations = Prisma.paymentsGetPayload<{ include: typeof paymentInclude }>;

export interface PaymentsListEnvelope {
  payments: Record<string, unknown>[];
  pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number };
}

export interface PaymentStats {
  totalCount: number;
  totalValue: number;
  completedCount: number;
  completedTotal: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
  refundedTotal: number;
  byStatus: { status: string; count: number; total: number }[];
  byMethod: { method: string; count: number; total: number }[];
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('payments', ...parts) ?? `payments:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private get payments() {
    return this.prisma.payments;
  }

  private wherePaymentDateClause(startDate?: string, endDate?: string): Prisma.Sql {
    if (startDate && endDate) {
      return Prisma.sql`WHERE ${Prisma.raw('payment_date')} BETWEEN ${startDate}::date AND ${endDate}::date AND deleted_at IS NULL`;
    }
    if (startDate) {
      return Prisma.sql`WHERE ${Prisma.raw('payment_date')} >= ${startDate}::date AND deleted_at IS NULL`;
    }
    if (endDate) {
      return Prisma.sql`WHERE ${Prisma.raw('payment_date')} <= ${endDate}::date AND deleted_at IS NULL`;
    }
    return Prisma.sql`WHERE deleted_at IS NULL`;
  }

  private async recalcInvoicePaymentStatus(invoiceId: number) {
    const invoice = await this.prisma.invoices.findUnique({ where: { id: invoiceId } });
    if (!invoice) return;

    const result = await this.prisma.payments.aggregate({
      where: { invoice_id: invoiceId, deleted_at: null },
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

    await this.prisma.invoices.update({
      where: { id: invoiceId },
      data: { amount_paid: paid, status, paid_at: paidAt },
    });
  }

  async findAll(query: Record<string, unknown>): Promise<PaymentsListEnvelope> {
    const cacheKey = this.cacheKey('list', JSON.stringify(query));
    return this.cache?.getOrSet(cacheKey, () => this.fetchFindAll(query), this.CACHE_TTL_SECONDS) ?? this.fetchFindAll(query);
  }

  private async fetchFindAll(query: Record<string, unknown>): Promise<PaymentsListEnvelope> {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(250, Math.max(1, Number(query.limit ?? 20)));
    const sortBy = (query.sortBy as string) || 'payment_date';
    const sortOrder = ((query.sortOrder as string) || 'DESC').toUpperCase() === 'ASC' ? 'asc' : 'desc';

    const where: Prisma.paymentsWhereInput = { deleted_at: null };

    if (query.status) where.status = query.status;
    if (query.payment_method) where.payment_method = { contains: query.payment_method as string, mode: 'insensitive' };

    if (query.dateFrom || query.dateTo) {
      const start = safeDate(query.dateFrom as string | undefined);
      const end = safeDate(query.dateTo as string | undefined);
      where.payment_date = {};
      if (start) (where.payment_date as Prisma.DateTimeNullableFilter).gte = start;
      if (end) {
        const endDate = new Date(end);
        endDate.setDate(endDate.getDate() + 1);
        (where.payment_date as Prisma.DateTimeNullableFilter).lt = endDate;
      }
    }

    const search = (query.search as string)?.trim();
    if (search) {
      const invoiceIds: number[] = [];
      const matchingInvoices = await this.prisma.invoices.findMany({
        where: {
          is_demo: false,
          OR: [
            { package_code: { contains: search, mode: 'insensitive' } },
            { client_name: { contains: search, mode: 'insensitive' } },
            { client_company: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      for (const inv of matchingInvoices) invoiceIds.push(inv.id);

      const searchOr: Prisma.paymentsWhereInput['OR'] = [
        { transaction_id: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
      if (invoiceIds.length > 0) {
        searchOr.push({ invoice_id: { in: invoiceIds } });
      }
      where.OR = searchOr;
    }

    let orderBy: Prisma.paymentsOrderByWithRelationInput | Prisma.paymentsOrderByWithRelationInput[] = {};
    if (sortBy === 'payment_date') {
      orderBy = [{ payment_date: { sort: sortOrder, nulls: 'last' } }, { created_at: sortOrder }];
    } else {
      const allowed = new Set(['created_at', 'amount', 'status', 'payment_method', 'transaction_id']);
      if (allowed.has(sortBy)) {
        orderBy = { [sortBy]: sortOrder };
      } else {
        orderBy = { created_at: sortOrder };
      }
    }

    const [total, rows] = await Promise.all([
      this.payments.count({ where }),
      this.payments.findMany({
        where,
        include: paymentInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      payments: rows.map((p) => mapPayment(p as unknown as Record<string, unknown> & { invoices?: Record<string, unknown> | null })),
      pagination: {
        currentPage: page,
        totalPages: total > 0 ? Math.ceil(total / limit) : 1,
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }

  async findOne(id: string | number) {
    const cacheKey = this.cacheKey('detail', id);
    return this.cache?.getOrSet(cacheKey, () => this.fetchFindOne(id), this.CACHE_TTL_SECONDS) ?? this.fetchFindOne(id);
  }

  private async fetchFindOne(id: string | number) {
    const payment = await this.payments.findUnique({
      where: { transaction_id: String(id), deleted_at: null },
      include: paymentInclude,
    });
    if (!payment) throw new NotFoundException({ success: false, message: 'Payment not found' });
    return { success: true, data: mapPayment(payment) };
  }

  async getStats(query: { dateFrom?: string; dateTo?: string }): Promise<PaymentStats> {
    const cacheKey = this.cacheKey('stats', JSON.stringify(query));
    return this.cache?.getOrSet(cacheKey, () => this.fetchGetStats(query), this.CACHE_TTL_SECONDS) ?? this.fetchGetStats(query);
  }

  private async fetchGetStats(query: { dateFrom?: string; dateTo?: string }): Promise<PaymentStats> {
    const where: Prisma.paymentsWhereInput = { deleted_at: null };

    if (query.dateFrom || query.dateTo) {
      const start = safeDate(query.dateFrom);
      const end = safeDate(query.dateTo);
      where.payment_date = {};
      if (start) (where.payment_date as Prisma.DateTimeNullableFilter).gte = start;
      if (end) {
        const endDate = new Date(end);
        endDate.setDate(endDate.getDate() + 1);
        (where.payment_date as Prisma.DateTimeNullableFilter).lt = endDate;
      }
    }

    const [byStatus, byMethod] = await Promise.all([
      this.payments.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
        _sum: { amount: true },
      }),
      this.payments.groupBy({
        by: ['payment_method'],
        where: { ...where, status: 'completed' },
        _count: { payment_method: true },
        _sum: { amount: true },
      }),
    ]);

    const statusRows = byStatus.map((row) => ({
      status: row.status,
      count: row._count.status,
      total: parseNumber(row._sum.amount),
    }));

    const methodRows = byMethod.map((row) => ({
      method: row.payment_method,
      count: row._count.payment_method,
      total: parseNumber(row._sum.amount),
    }));

    const statusDict: Record<string, { count: number; total: number }> = {};
    for (const row of statusRows) statusDict[row.status] = { count: row.count, total: row.total };

    const get = (key: string) => statusDict[key] || { count: 0, total: 0 };
    const completed = get('completed');
    const partialRef = get('partially_refunded');
    const pending = get('pending');
    const processing = get('processing');
    const failed = get('failed');
    const cancelled = get('cancelled');
    const refunded = get('refunded');

    const totalCount = statusRows.reduce((s, r) => s + r.count, 0);
    const totalValue = statusRows.reduce((s, r) => s + r.total, 0);

    return {
      totalCount,
      totalValue,
      completedCount: completed.count + partialRef.count,
      completedTotal: completed.total + partialRef.total,
      pendingCount: pending.count + processing.count,
      failedCount: failed.count + cancelled.count,
      refundedCount: refunded.count,
      refundedTotal: refunded.total,
      byStatus: statusRows,
      byMethod: methodRows,
    };
  }

  async create(user: Profile, dto: Record<string, unknown>) {
    const amount = parseNumber(dto.amount);
    if (amount <= 0) throw new BadRequestException({ message: 'Payment amount must be greater than 0' });

    let invoiceId: number | undefined;
    if (dto.invoice_id) {
      const invoice = await this.prisma.invoices.findUnique({ where: { id: Number(dto.invoice_id) } });
      if (!invoice) throw new NotFoundException({ message: 'Invoice not found' });

      const docType = invoice.document_type;
      if (docType === 'estimate' || docType === 'quote') {
        throw new BadRequestException({ message: 'Cannot record payments for estimates/quotes. Convert to invoice first.' });
      }

      const remaining = parseNumber(invoice.total_amount) - parseNumber(invoice.amount_paid);
      if (amount > remaining) {
        throw new BadRequestException({ message: `Payment amount (${amount}) exceeds remaining balance (${remaining})` });
      }
      invoiceId = invoice.id;
    }

    const transactionId = (dto.transaction_id as string) || `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const currency = (dto.currency as string) || 'AUD';

    const data: Prisma.paymentsUncheckedCreateInput = {
      invoice_id: invoiceId || null,
      amount,
      currency,
      payment_method: (dto.payment_method as string) || 'bank_transfer',
      payment_provider: (dto.payment_provider as string) || 'manual',
      transaction_id: transactionId,
      payment_date: safeDate(dto.payment_date as string) || new Date(),
      status: 'completed',
      notes: (dto.notes as string) || null,
      gateway_response: dto.gateway_response ? JSON.stringify(dto.gateway_response) : null,
      created_by: user.id,
    };

    const payment = await this.payments.create({ data, include: paymentInclude });

    if (invoiceId) {
      await this.recalcInvoicePaymentStatus(invoiceId);
      await this.cache?.delPrefix(this.cache?.key('invoices') ?? 'invoices');
    }
    await this.invalidateCache();

    return {
      message: 'Payment recorded successfully',
      payment: mapPayment(payment),
    };
  }

  async remove(user: Profile, id: string) {
    let payment: PaymentWithRelations | null = null;
    payment = await this.payments.findUnique({ where: { transaction_id: id }, include: paymentInclude });

    if (!payment) {
      const numericId = Number(id);
      if (!isNaN(numericId)) {
        payment = await this.payments.findFirst({ where: { id: numericId, deleted_at: null }, include: paymentInclude });
      }
    }

    if (!payment) throw new NotFoundException({ success: false, message: 'Payment not found' });

    const invoiceId = payment.invoice_id;

    await this.payments.update({
      where: { transaction_id: payment.transaction_id },
      data: { deleted_at: new Date() },
    });

    if (invoiceId) {
      await this.recalcInvoicePaymentStatus(invoiceId);
      await this.cache?.delPrefix(this.cache?.key('invoices') ?? 'invoices');
    }
    await this.invalidateCache();

    return buildLegacyMessageEnvelope('Payment deleted successfully');
  }
}
