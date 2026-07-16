import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import {
  asExpenseCategory,
  asExpensePaymentMethod,
  asExpenseStatus,
  asReceiptStatus,
  asJsonInput,
  buildLegacyDataEnvelope,
  buildLegacyListEnvelope,
  buildLegacyMessageEnvelope,
  defaultExchangeRate,
  expenseInclude,
  mapExpense,
  mapReceipt,
  parseDateOnly,
  parseNumber,
  receiptInclude,
  safeDate,
} from './finance-utils';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private get expenses() {
    return this.prisma.expenses;
  }

  private get receipts() {
    return this.prisma.receipts;
  }

  private isAdminOrManager(user: Profile) {
    return user.role === 'admin' || user.role === 'manager';
  }

  private assertAdminManagerOrOwner(
    user: Profile,
    expense: { created_by: number | null; status?: string | null },
    message = 'Not authorized to access this expense',
  ) {
    if (this.isAdminOrManager(user)) return;
    if (expense.created_by === user.id) return;
    throw new ForbiddenException({ success: false, message });
  }

  private whereDateClause(table: string, startDate?: string, endDate?: string): Prisma.Sql {
    const column = table === 'receipts' ? 'receipt_date' : 'expense_date';
    if (startDate && endDate) {
      return Prisma.sql`WHERE ${Prisma.raw(column)} BETWEEN ${startDate}::date AND ${endDate}::date`;
    }
    if (startDate) {
      return Prisma.sql`WHERE ${Prisma.raw(column)} >= ${startDate}::date`;
    }
    if (endDate) {
      return Prisma.sql`WHERE ${Prisma.raw(column)} <= ${endDate}::date`;
    }
    return Prisma.empty;
  }

  private async generateExpenseNumber() {
    const year = new Date().getFullYear();
    const prefix = `EXP-${year}-`;
    const count = await this.expenses.count({ where: { expense_number: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  private async generateReceiptNumber() {
    const year = new Date().getFullYear();
    const prefix = `RCP-${year}-`;
    const count = await this.receipts.count({ where: { receipt_number: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  async getStats(startDate?: string, endDate?: string) {
    const where = this.whereDateClause('expenses', startDate, endDate);

    type TotalRow = { total_count: bigint; total_amount: Prisma.Decimal | number };
    type CategoryRow = { category: string; count: bigint; amount: Prisma.Decimal | number };
    type StatusRow = { status: string; count: bigint; amount: Prisma.Decimal | number };
    type MonthRow = { month: string; count: bigint; amount: Prisma.Decimal | number };
    type SpecialRow = {
      pending_approval: bigint;
      pending_reimbursement: bigint;
      billable_unbilled: bigint;
    };

    const [totalRows, categoryRows, statusRows, monthRows, specialRows] = await Promise.all([
      this.prisma.$queryRaw<TotalRow[]>`
        SELECT COUNT(*) as total_count, COALESCE(SUM(total_amount * exchange_rate), 0) as total_amount
        FROM expenses ${where}
      `,
      this.prisma.$queryRaw<CategoryRow[]>`
        SELECT category, COUNT(*) as count, COALESCE(SUM(total_amount * exchange_rate), 0) as amount
        FROM expenses ${where}
        GROUP BY category
      `,
      this.prisma.$queryRaw<StatusRow[]>`
        SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount * exchange_rate), 0) as amount
        FROM expenses ${where}
        GROUP BY status
      `,
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT TO_CHAR(expense_date, 'YYYY-MM') as month, COUNT(*) as count, COALESCE(SUM(total_amount * exchange_rate), 0) as amount
        FROM expenses ${where}
        GROUP BY month
        ORDER BY month
      `,
      this.prisma.$queryRaw<SpecialRow[]>`
        SELECT
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_approval,
          SUM(CASE WHEN is_reimbursable = true AND status = 'approved' THEN 1 ELSE 0 END) as pending_reimbursement,
          SUM(CASE WHEN is_billable = true AND invoice_id IS NULL THEN 1 ELSE 0 END) as billable_unbilled
        FROM expenses ${where}
      `,
    ]);

    const total = totalRows[0] ?? { total_count: 0n, total_amount: 0 };
    const special = specialRows[0] ?? { pending_approval: 0n, pending_reimbursement: 0n, billable_unbilled: 0n };

    const byCategory: Record<string, { count: number; amount: number }> = {};
    for (const row of categoryRows) {
      byCategory[row.category] = { count: Number(row.count), amount: parseNumber(row.amount) };
    }

    const byStatus: Record<string, { count: number; amount: number }> = {};
    for (const row of statusRows) {
      byStatus[row.status] = { count: Number(row.count), amount: parseNumber(row.amount) };
    }

    const byMonth: Record<string, { count: number; amount: number }> = {};
    for (const row of monthRows) {
      if (row.month) {
        byMonth[row.month] = { count: Number(row.count), amount: parseNumber(row.amount) };
      }
    }

    return {
      total_count: Number(total.total_count),
      total_amount: parseNumber(total.total_amount),
      by_category: byCategory,
      by_status: byStatus,
      by_month: byMonth,
      pending_approval: Number(special.pending_approval),
      pending_reimbursement: Number(special.pending_reimbursement),
      billable_unbilled: Number(special.billable_unbilled),
    };
  }

  async findAll(query: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC'; [key: string]: unknown }, user: Profile) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(250, Math.max(1, Number(query.limit ?? 20)));
    const sortBy = (query.sortBy as string) || 'expense_date';
    const sortOrder = ((query.sortOrder as string) || 'DESC').toUpperCase() === 'ASC' ? 'asc' : 'desc';
    const allowedSortFields = new Set(['expense_date', 'category', 'vendor_name', 'status', 'total_amount', 'amount', 'expense_number', 'created_at']);
    const orderByField = allowedSortFields.has(sortBy) ? sortBy : 'expense_date';

    const where: Prisma.expensesWhereInput = {};

    if (!this.isAdminOrManager(user)) {
      where.created_by = user.id;
    }

    if (query.category) where.category = asExpenseCategory(query.category as string);
    if (query.status) where.status = asExpenseStatus(query.status as string);
    if (query.employee_id) where.employee_id = Number(query.employee_id);
    if (query.invoice_id) where.invoice_id = Number(query.invoice_id);

    const isBillable = query.is_billable as string | undefined;
    if (isBillable !== undefined) where.is_billable = isBillable === 'true';

    const isReimbursable = query.is_reimbursable as string | undefined;
    if (isReimbursable !== undefined) where.is_reimbursable = isReimbursable === 'true';

    if (query.start_date || query.end_date) {
      const start = safeDate(query.start_date as string | undefined);
      const end = safeDate(query.end_date as string | undefined);
      where.expense_date = {};
      if (start) (where.expense_date as Prisma.DateTimeFilter).gte = start;
      if (end) (where.expense_date as Prisma.DateTimeFilter).lte = end;
    }

    const search = (query.search as string)?.trim();
    if (search) {
      where.OR = [
        { expense_number: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { vendor_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.expenses.count({ where }),
      this.expenses.findMany({
        where,
        include: expenseInclude,
        orderBy: { [orderByField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return buildLegacyListEnvelope(rows.map(mapExpense), total, page, limit);
  }

  async findPendingApproval() {
    const rows = await this.expenses.findMany({
      where: { status: 'pending' },
      include: expenseInclude,
      orderBy: { expense_date: 'desc' },
    });
    return buildLegacyDataEnvelope(rows.map(mapExpense));
  }

  async findReimbursable(employeeId?: number) {
    const where: Prisma.expensesWhereInput = { is_reimbursable: true, status: 'approved' };
    if (employeeId) where.employee_id = employeeId;
    const rows = await this.expenses.findMany({ where, include: expenseInclude, orderBy: { expense_date: 'desc' } });
    return buildLegacyDataEnvelope(rows.map(mapExpense));
  }

  async findBillable(contactId?: number, companyId?: number) {
    const where: Prisma.expensesWhereInput = { is_billable: true, invoice_id: null };
    if (contactId) where.billed_to_contact_id = contactId;
    if (companyId) where.billed_to_company_id = companyId;
    const rows = await this.expenses.findMany({ where, include: expenseInclude, orderBy: { expense_date: 'desc' } });
    return buildLegacyDataEnvelope(rows.map(mapExpense));
  }

  async findOne(id: number, user: Profile) {
    const expense = await this.expenses.findUnique({ where: { id }, include: expenseInclude });
    if (!expense) throw new NotFoundException({ success: false, message: 'Expense not found' });

    if (!this.isAdminOrManager(user)) {
      const isOwner = expense.created_by === user.id;
      const isApprover = expense.approved_by === user.id;
      const isEmployee = expense.employees?.profiles?.id === user.id;
      if (!isOwner && !isApprover && !isEmployee) {
        throw new ForbiddenException({ success: false, message: 'Not authorized to view this expense' });
      }
    }

    return buildLegacyDataEnvelope(mapExpense(expense));
  }

  async create(userId: number, dto: Record<string, unknown>) {
    let employeeId = dto.employee_id as number | undefined;
    if (!employeeId) {
      const employee = await this.prisma.employees.findFirst({ where: { user_id: userId }, select: { id: true } });
      if (employee) employeeId = employee.id;
    }

    const amount = parseNumber(dto.amount);
    const taxAmount = parseNumber(dto.tax_amount);
    const currency = (dto.currency as string) || 'AUD';

    const data: Prisma.expensesUncheckedCreateInput = {
      expense_number: await this.generateExpenseNumber(),
      description: dto.description as string,
      notes: (dto.notes as string) || null,
      category: asExpenseCategory((dto.category as string) || 'other') || 'other',
      subcategory: (dto.subcategory as string) || null,
      vendor_name: (dto.vendor_name as string) || null,
      vendor_id: dto.vendor_id ? Number(dto.vendor_id) : null,
      amount,
      tax_amount: taxAmount,
      tax_rate: parseNumber(dto.tax_rate) || 0,
      total_amount: amount + taxAmount,
      currency,
      exchange_rate: defaultExchangeRate(currency),
      expense_date: parseDateOnly(dto.expense_date as string) as Date,
      payment_method: asExpensePaymentMethod(dto.payment_method as string) || null,
      payment_reference: (dto.payment_reference as string) || null,
      paid_from_account: (dto.paid_from_account as string) || null,
      is_reimbursable: Boolean(dto.is_reimbursable),
      reimbursed_to: dto.reimbursed_to ? Number(dto.reimbursed_to) : null,
      is_billable: Boolean(dto.is_billable),
      status: 'pending',
      project_id: dto.project_id ? Number(dto.project_id) : null,
      deal_id: dto.deal_id ? Number(dto.deal_id) : null,
      crm_project_id: dto.crm_project_id ? Number(dto.crm_project_id) : null,
      crm_subproject_id: dto.crm_subproject_id ? Number(dto.crm_subproject_id) : null,
      employee_id: employeeId || null,
      tags: asJsonInput(dto.tags) ?? [],
      receipts: asJsonInput(dto.receipts) ?? [],
      created_by: userId,
    };

    const created = await this.expenses.create({ data, include: expenseInclude });
    return buildLegacyDataEnvelope(mapExpense(created));
  }

  async update(id: number, dto: Record<string, unknown>, user: Profile) {
    const expense = await this.expenses.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException({ success: false, message: 'Expense not found' });

    this.assertAdminManagerOrOwner(user, expense, 'Not authorized to update this expense');

    if ((expense.status === 'approved' || expense.status === 'reimbursed') && user.role !== 'admin') {
      throw new BadRequestException({ success: false, message: 'Cannot edit approved or reimbursed expenses' });
    }

    const updates: Prisma.expensesUncheckedUpdateInput = {};

    if (dto.description !== undefined) updates.description = dto.description as string;
    if (dto.notes !== undefined) updates.notes = (dto.notes) || null;
    if (dto.category !== undefined) updates.category = asExpenseCategory(dto.category as string);
    if (dto.subcategory !== undefined) updates.subcategory = (dto.subcategory) || null;
    if (dto.vendor_name !== undefined) updates.vendor_name = (dto.vendor_name) || null;
    if (dto.vendor_id !== undefined) updates.vendor_id = dto.vendor_id ? Number(dto.vendor_id) : null;
    if (dto.payment_reference !== undefined) updates.payment_reference = (dto.payment_reference) || null;
    if (dto.paid_from_account !== undefined) updates.paid_from_account = (dto.paid_from_account) || null;
    if (dto.is_reimbursable !== undefined) updates.is_reimbursable = Boolean(dto.is_reimbursable);
    if (dto.reimbursed_to !== undefined) updates.reimbursed_to = dto.reimbursed_to ? Number(dto.reimbursed_to) : null;
    if (dto.is_billable !== undefined) updates.is_billable = Boolean(dto.is_billable);
    if (dto.project_id !== undefined) updates.project_id = dto.project_id ? Number(dto.project_id) : null;
    if (dto.deal_id !== undefined) updates.deal_id = dto.deal_id ? Number(dto.deal_id) : null;
    if (dto.crm_project_id !== undefined) updates.crm_project_id = dto.crm_project_id ? Number(dto.crm_project_id) : null;
    if (dto.crm_subproject_id !== undefined) updates.crm_subproject_id = dto.crm_subproject_id ? Number(dto.crm_subproject_id) : null;
    if (dto.employee_id !== undefined) updates.employee_id = dto.employee_id ? Number(dto.employee_id) : null;
    if (dto.tags !== undefined) updates.tags = asJsonInput(dto.tags) ?? [];
    if (dto.receipts !== undefined) updates.receipts = asJsonInput(dto.receipts) ?? [];

    if (dto.expense_date !== undefined) {
      updates.expense_date = parseDateOnly(dto.expense_date as string);
    }

    if (dto.currency !== undefined) {
      const currency = (dto.currency as string) || expense.currency || 'AUD';
      updates.currency = currency;
      updates.exchange_rate = defaultExchangeRate(currency);
    }

    if (dto.payment_method !== undefined) updates.payment_method = asExpensePaymentMethod(dto.payment_method as string) || null;

    if (dto.amount !== undefined || dto.tax_amount !== undefined) {
      const amount = dto.amount !== undefined ? parseNumber(dto.amount) : parseNumber(expense.amount);
      const taxAmount = dto.tax_amount !== undefined ? parseNumber(dto.tax_amount) : parseNumber(expense.tax_amount);
      updates.amount = amount;
      updates.tax_amount = taxAmount;
      updates.total_amount = amount + taxAmount;
    }

    if (dto.tax_rate !== undefined) updates.tax_rate = parseNumber(dto.tax_rate);

    const updated = await this.expenses.update({ where: { id }, data: updates, include: expenseInclude });
    return buildLegacyDataEnvelope(mapExpense(updated));
  }

  async remove(id: number, user: Profile) {
    const expense = await this.expenses.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException({ success: false, message: 'Expense not found' });

    this.assertAdminManagerOrOwner(user, expense, 'Not authorized to delete this expense');

    if ((expense.status === 'approved' || expense.status === 'reimbursed') && !this.isAdminOrManager(user)) {
      throw new BadRequestException({ success: false, message: 'Cannot delete approved or reimbursed expenses' });
    }

    await this.expenses.delete({ where: { id } });
    return buildLegacyMessageEnvelope('Expense deleted');
  }

  async approve(id: number, userId: number) {
    const expense = await this.expenses.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException({ success: false, message: 'Expense not found' });

    const updated = await this.expenses.update({
      where: { id },
      data: { status: 'approved', approved_by: userId, approved_at: new Date() },
      include: expenseInclude,
    });
    return buildLegacyMessageEnvelope('Expense approved', mapExpense(updated));
  }

  async reject(id: number, userId: number, reason?: string) {
    const expense = await this.expenses.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException({ success: false, message: 'Expense not found' });

    const updated = await this.expenses.update({
      where: { id },
      data: { status: 'rejected', approved_by: userId, approved_at: new Date(), rejection_reason: reason || null },
      include: expenseInclude,
    });
    return buildLegacyMessageEnvelope('Expense rejected', mapExpense(updated));
  }

  async reimburse(id: number, reference?: string) {
    const expense = await this.expenses.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException({ success: false, message: 'Expense not found' });
    if (!expense.is_reimbursable) {
      throw new BadRequestException({ success: false, message: 'Expense is not marked as reimbursable' });
    }

    const updated = await this.expenses.update({
      where: { id },
      data: { status: 'reimbursed', reimbursed_at: new Date(), reimbursement_reference: reference || null },
      include: expenseInclude,
    });
    return buildLegacyMessageEnvelope('Expense marked as reimbursed', mapExpense(updated));
  }

  async addToInvoice(id: number, invoiceId: number, user: Profile) {
    const expense = await this.expenses.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException({ success: false, message: 'Expense not found' });

    this.assertAdminManagerOrOwner(user, expense, 'Not authorized to update this expense');

    if (!expense.is_billable) {
      throw new BadRequestException({ success: false, message: 'Expense is not marked as billable' });
    }

    const updated = await this.expenses.update({
      where: { id },
      data: { invoice_id: invoiceId, is_billable: true },
      include: expenseInclude,
    });
    return buildLegacyMessageEnvelope('Expense added to invoice', mapExpense(updated));
  }

  async duplicate(id: number, userId: number) {
    const expense = await this.expenses.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException({ success: false, message: 'Expense not found' });

    const data: Prisma.expensesUncheckedCreateInput = {
      expense_number: await this.generateExpenseNumber(),
      description: expense.description,
      notes: expense.notes,
      category: expense.category,
      subcategory: expense.subcategory,
      vendor_name: expense.vendor_name,
      vendor_id: expense.vendor_id,
      amount: parseNumber(expense.amount),
      tax_amount: parseNumber(expense.tax_amount),
      tax_rate: parseNumber(expense.tax_rate),
      total_amount: parseNumber(expense.total_amount),
      currency: expense.currency || 'AUD',
      exchange_rate: parseNumber(expense.exchange_rate) || 1,
      expense_date: new Date(),
      payment_method: expense.payment_method,
      payment_reference: expense.payment_reference,
      paid_from_account: expense.paid_from_account,
      is_reimbursable: expense.is_reimbursable,
      is_billable: expense.is_billable,
      status: 'pending',
      project_id: expense.project_id,
      deal_id: expense.deal_id,
      crm_project_id: expense.crm_project_id,
      crm_subproject_id: expense.crm_subproject_id,
      employee_id: expense.employee_id,
      tags: asJsonInput(expense.tags) ?? [],
      receipts: asJsonInput(expense.receipts) ?? [],
      created_by: userId,
    };

    const created = await this.expenses.create({ data, include: expenseInclude });
    return buildLegacyMessageEnvelope('Expense duplicated', mapExpense(created));
  }

  async addReceipt(id: number, dto: { name: string; url: string; size?: number; mimeType?: string }, user: Profile) {
    const expense = await this.expenses.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException({ success: false, message: 'Expense not found' });

    this.assertAdminManagerOrOwner(user, expense, 'Not authorized to add receipt to this expense');

    const receipts = (asJsonInput(expense.receipts) as unknown as unknown[] | undefined) ?? [];
    receipts.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name: dto.name,
      url: dto.url,
      size: dto.size ?? null,
      mimeType: dto.mimeType ?? null,
      uploadedAt: new Date().toISOString(),
    });

    const updated = await this.expenses.update({
      where: { id },
      data: { receipts: asJsonInput(receipts) },
      include: expenseInclude,
    });
    return buildLegacyMessageEnvelope('Receipt added', mapExpense(updated));
  }

  // Receipts

  async findReceipts(query: { page?: number; limit?: number; status?: string; start_date?: string; end_date?: string }, user: Profile) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(250, Math.max(1, Number(query.limit ?? 20)));

    const where: Prisma.receiptsWhereInput = {};
    if (!this.isAdminOrManager(user)) {
      where.uploaded_by = user.id;
    }
    if (query.status) where.status = asReceiptStatus(query.status);
    if (query.start_date || query.end_date) {
      const start = safeDate(query.start_date);
      const end = safeDate(query.end_date);
      where.receipt_date = {};
      if (start) (where.receipt_date as Prisma.DateTimeFilter).gte = start;
      if (end) (where.receipt_date as Prisma.DateTimeFilter).lte = end;
    }

    const [total, rows] = await Promise.all([
      this.receipts.count({ where }),
      this.receipts.findMany({ where, include: receiptInclude, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);

    return buildLegacyListEnvelope(rows.map(mapReceipt), total, page, limit);
  }

  async findUnmatchedReceipts() {
    const rows = await this.receipts.findMany({
      where: { status: 'processed', expense_id: null },
      include: receiptInclude,
      orderBy: { receipt_date: 'desc' },
    });
    return buildLegacyDataEnvelope(rows.map(mapReceipt));
  }

  async getReceiptStats(startDate?: string, endDate?: string) {
    const where = this.whereDateClause('receipts', startDate, endDate);

    type TotalRow = {
      total_count: bigint;
      total_amount: Prisma.Decimal | number;
      unprocessed: bigint;
      processed: bigint;
      matched: bigint;
      archived: bigint;
      ocr_pending: bigint;
    };
    type VendorRow = { vendor_name: string | null; count: bigint; amount: Prisma.Decimal | number };

    const [totalRows, vendorRows] = await Promise.all([
      this.prisma.$queryRaw<TotalRow[]>`
        SELECT
          COUNT(*) as total_count,
          COALESCE(SUM(total_amount), 0) as total_amount,
          SUM(CASE WHEN status = 'unprocessed' THEN 1 ELSE 0 END) as unprocessed,
          SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed,
          SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
          SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
          SUM(CASE WHEN ocr_status = 'pending' THEN 1 ELSE 0 END) as ocr_pending
        FROM receipts ${where}
      `,
      this.prisma.$queryRaw<VendorRow[]>`
        SELECT vendor_name, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount
        FROM receipts ${where}
        GROUP BY vendor_name
      `,
    ]);

    const total = totalRows[0] ?? {
      total_count: 0n,
      total_amount: 0,
      unprocessed: 0n,
      processed: 0n,
      matched: 0n,
      archived: 0n,
      ocr_pending: 0n,
    };

    const byVendor: Record<string, { count: number; amount: number }> = {};
    for (const row of vendorRows) {
      const name = row.vendor_name || 'Unknown';
      byVendor[name] = { count: Number(row.count), amount: parseNumber(row.amount) };
    }

    return {
      total_count: Number(total.total_count),
      total_amount: parseNumber(total.total_amount),
      unprocessed: Number(total.unprocessed),
      processed: Number(total.processed),
      matched: Number(total.matched),
      archived: Number(total.archived),
      ocr_pending: Number(total.ocr_pending),
      by_vendor: byVendor,
    };
  }

  async findReceipt(id: number, user: Profile) {
    const receipt = await this.receipts.findUnique({ where: { id }, include: receiptInclude });
    if (!receipt) throw new NotFoundException({ success: false, message: 'Receipt not found' });

    if (!this.isAdminOrManager(user) && receipt.uploaded_by !== user.id) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to access this receipt' });
    }

    return buildLegacyDataEnvelope(mapReceipt(receipt));
  }

  async createReceipt(userId: number, dto: Record<string, unknown>) {
    const data: Prisma.receiptsUncheckedCreateInput = {
      receipt_number: await this.generateReceiptNumber(),
      file_name: dto.file_name as string,
      file_url: dto.file_url as string,
      file_size: dto.file_size ? Number(dto.file_size) : null,
      file_type: (dto.file_type as string) || null,
      vendor_name: (dto.vendor_name as string) || null,
      receipt_date: parseDateOnly(dto.receipt_date as string) || new Date(),
      subtotal: dto.subtotal ? parseNumber(dto.subtotal) : null,
      tax_amount: dto.tax_amount ? parseNumber(dto.tax_amount) : null,
      total_amount: dto.total_amount ? parseNumber(dto.total_amount) : null,
      currency: (dto.currency as string) || 'AUD',
      payment_method: (dto.payment_method as string) || null,
      category: (dto.category as string) || null,
      notes: (dto.notes as string) || null,
      vendor_id: dto.vendor_id ? Number(dto.vendor_id) : null,
      uploaded_by: userId,
      ocr_status: 'pending',
      status: 'unprocessed',
      is_duplicate: false,
    };

    const created = await this.receipts.create({ data, include: receiptInclude });
    return buildLegacyDataEnvelope(mapReceipt(created));
  }

  async updateReceipt(id: number, dto: Record<string, unknown>, user: Profile) {
    const receipt = await this.receipts.findUnique({ where: { id } });
    if (!receipt) throw new NotFoundException({ success: false, message: 'Receipt not found' });

    if (!this.isAdminOrManager(user) && receipt.uploaded_by !== user.id) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to access this receipt' });
    }

    const updates: Prisma.receiptsUncheckedUpdateInput = {};
    if (dto.file_name !== undefined) updates.file_name = dto.file_name as string;
    if (dto.file_url !== undefined) updates.file_url = dto.file_url as string;
    if (dto.file_size !== undefined) updates.file_size = dto.file_size ? Number(dto.file_size) : null;
    if (dto.file_type !== undefined) updates.file_type = (dto.file_type) || null;
    if (dto.vendor_name !== undefined) updates.vendor_name = (dto.vendor_name) || null;
    if (dto.receipt_date !== undefined) updates.receipt_date = parseDateOnly(dto.receipt_date as string) || null;
    if (dto.subtotal !== undefined) updates.subtotal = dto.subtotal ? parseNumber(dto.subtotal) : null;
    if (dto.tax_amount !== undefined) updates.tax_amount = dto.tax_amount ? parseNumber(dto.tax_amount) : null;
    if (dto.total_amount !== undefined) updates.total_amount = dto.total_amount ? parseNumber(dto.total_amount) : null;
    if (dto.currency !== undefined) updates.currency = (dto.currency) || 'AUD';
    if (dto.payment_method !== undefined) updates.payment_method = (dto.payment_method) || null;
    if (dto.category !== undefined) updates.category = (dto.category) || null;
    if (dto.notes !== undefined) updates.notes = (dto.notes) || null;
    if (dto.vendor_id !== undefined) updates.vendor_id = dto.vendor_id ? Number(dto.vendor_id) : null;

    const updated = await this.receipts.update({ where: { id }, data: updates, include: receiptInclude });
    return buildLegacyDataEnvelope(mapReceipt(updated));
  }

  async removeReceipt(id: number, user: Profile) {
    const receipt = await this.receipts.findUnique({ where: { id } });
    if (!receipt) throw new NotFoundException({ success: false, message: 'Receipt not found' });

    if (!this.isAdminOrManager(user) && receipt.uploaded_by !== user.id) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to access this receipt' });
    }

    await this.receipts.delete({ where: { id } });
    return buildLegacyMessageEnvelope('Receipt deleted');
  }

  async linkReceiptToExpense(receiptId: number, expenseId: number, user: Profile) {
    const receipt = await this.receipts.findUnique({ where: { id: receiptId } });
    if (!receipt) throw new NotFoundException({ success: false, message: 'Receipt not found' });

    if (!this.isAdminOrManager(user) && receipt.uploaded_by !== user.id) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to access this receipt' });
    }

    const updated = await this.receipts.update({
      where: { id: receiptId },
      data: { expense_id: expenseId, status: 'matched' },
      include: receiptInclude,
    });
    return buildLegacyMessageEnvelope('Receipt linked to expense', mapReceipt(updated));
  }

  async unlinkReceipt(receiptId: number, user: Profile) {
    const receipt = await this.receipts.findUnique({ where: { id: receiptId } });
    if (!receipt) throw new NotFoundException({ success: false, message: 'Receipt not found' });

    if (!this.isAdminOrManager(user) && receipt.uploaded_by !== user.id) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to access this receipt' });
    }

    const status = receipt.total_amount ? 'processed' : 'unprocessed';
    const updated = await this.receipts.update({
      where: { id: receiptId },
      data: { expense_id: null, status },
      include: receiptInclude,
    });
    return buildLegacyMessageEnvelope('Receipt unlinked', mapReceipt(updated));
  }

  async createExpenseFromReceipt(receiptId: number, user: Profile, dto: Record<string, unknown>) {
    const receipt = await this.receipts.findUnique({ where: { id: receiptId } });
    if (!receipt) throw new NotFoundException({ success: false, message: 'Receipt not found' });

    if (!this.isAdminOrManager(user) && receipt.uploaded_by !== user.id) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to access this receipt' });
    }

    const amount = dto.amount !== undefined ? parseNumber(dto.amount) : parseNumber(receipt.total_amount || receipt.subtotal);
    const currency = (dto.currency as string) || receipt.currency || 'AUD';

    const data: Prisma.expensesUncheckedCreateInput = {
      expense_number: await this.generateExpenseNumber(),
      description: (dto.description as string) || `Receipt from ${receipt.vendor_name || 'Unknown Vendor'}`,
      vendor_name: (dto.vendor_name as string) || receipt.vendor_name,
      amount,
      tax_amount: dto.tax_amount !== undefined ? parseNumber(dto.tax_amount) : parseNumber(receipt.tax_amount),
      total_amount: dto.total_amount !== undefined ? parseNumber(dto.total_amount) : parseNumber(receipt.total_amount) || amount,
      currency,
      exchange_rate: defaultExchangeRate(currency),
      expense_date: parseDateOnly(dto.expense_date as string) || receipt.receipt_date || new Date(),
      category: asExpenseCategory((dto.category as string) || receipt.category || 'other') || 'other',
      subcategory: (dto.subcategory as string) || null,
      payment_method: asExpensePaymentMethod(dto.payment_method as string) || null,
      notes: (dto.notes as string) || null,
      is_reimbursable: Boolean(dto.is_reimbursable),
      is_billable: Boolean(dto.is_billable),
      project_id: dto.project_id ? Number(dto.project_id) : null,
      deal_id: dto.deal_id ? Number(dto.deal_id) : null,
      crm_project_id: dto.crm_project_id ? Number(dto.crm_project_id) : null,
      tags: asJsonInput(dto.tags) ?? [],
      receipts: [
        {
          id: receipt.id,
          name: receipt.file_name,
          url: receipt.file_url,
          uploadedAt: receipt.created_at,
        },
      ],
      created_by: user.id,
      status: 'pending',
    };

    const expense = await this.expenses.create({ data, include: expenseInclude });

    const updatedReceipt = await this.receipts.update({
      where: { id: receiptId },
      data: { expense_id: expense.id, status: 'matched' },
      include: receiptInclude,
    });

    return buildLegacyMessageEnvelope('Expense created from receipt', { expense: mapExpense(expense), receipt: mapReceipt(updatedReceipt) });
  }
}
