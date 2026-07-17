import { Response } from 'express';
import { Prisma } from '@prisma/client';
import {
  document_type_enum,
  enum_expenses_category,
  enum_expenses_payment_method,
  enum_expenses_status,
  enum_receipts_ocr_status,
  enum_receipts_status,
  enum_receipts_upload_source,
} from '@prisma/client';
import { toNumber, safeDate, asJsonInput } from '../crm/crm-utils';

export { toNumber, safeDate, asJsonInput };

export function setNoCache(res: Response): void {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
}

export function buildLegacyPagination(total: number, page: number, limit: number) {
  return {
    total,
    page,
    pages: total > 0 ? Math.ceil(total / limit) : 1,
    limit,
  };
}

export function buildLegacyListEnvelope<T>(items: T[], total: number, page: number, limit: number) {
  return {
    success: true,
    data: items,
    pagination: buildLegacyPagination(total, page, limit),
  };
}

export function buildLegacyDataEnvelope<T>(data: T) {
  return { success: true, data };
}

export function buildLegacyMessageEnvelope(message: string, data?: unknown) {
  const envelope: Record<string, unknown> = { success: true, message };
  if (data !== undefined) envelope.data = data;
  return envelope;
}

export function asExpenseCategory(value?: string): enum_expenses_category | undefined {
  if (!value) return undefined;
  return value as enum_expenses_category;
}

export function asExpensePaymentMethod(value?: string): enum_expenses_payment_method | undefined {
  if (!value) return undefined;
  return value as enum_expenses_payment_method;
}

export function asExpenseStatus(value?: string): enum_expenses_status | undefined {
  if (!value) return undefined;
  return value as enum_expenses_status;
}

export function asReceiptStatus(value?: string): enum_receipts_status | undefined {
  if (!value) return undefined;
  return value as enum_receipts_status;
}

export function asReceiptOcrStatus(value?: string): enum_receipts_ocr_status | undefined {
  if (!value) return undefined;
  return value as enum_receipts_ocr_status;
}

export function asReceiptUploadSource(value?: string): enum_receipts_upload_source | undefined {
  if (!value) return undefined;
  return value as enum_receipts_upload_source;
}

export function defaultExchangeRate(currency?: string): number {
  if (currency === 'USD') return 1.55;
  if (currency === 'BDT') return 0.0125;
  return 1.0;
}

export function parseNumber(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (typeof value === 'object' && value !== null && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber() || 0;
  }
  return 0;
}

export type ExpenseWithRelations = Prisma.expensesGetPayload<{
  include: typeof expenseInclude;
}>;

export const expenseInclude = {
  companies_expenses_vendor_idTocompanies: { select: { id: true, name: true } },
  profiles_expenses_created_byToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
  profiles_expenses_approved_byToprofiles: { select: { id: true, first_name: true, last_name: true } },
  profiles_expenses_reimbursed_toToprofiles: { select: { id: true, first_name: true, last_name: true } },
  employees: {
    select: {
      id: true,
      profiles: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
  },
  invoices: { select: { id: true, package_code: true, title: true } },
  deals: { select: { id: true, name: true } },
  crm_projects: { select: { id: true, name: true, project_number: true } },
  crm_subprojects: { select: { id: true, name: true } },
  receipt_records: true,
} as const;

export function mapExpense(expense: ExpenseWithRelations) {
  const e = expense as unknown as Record<string, unknown>;
  return {
    ...e,
    vendor: e.companies_expenses_vendor_idTocompanies,
    creator: e.profiles_expenses_created_byToprofiles,
    approver: e.profiles_expenses_approved_byToprofiles,
    reimbursedToUser: e.profiles_expenses_reimbursed_toToprofiles,
    employee: e.employees
      ? { ...e.employees, user: (e.employees as { profiles?: unknown }).profiles }
      : undefined,
    crmProject: e.crm_projects,
    crmSubproject: e.crm_subprojects,
    linkedReceipts: e.receipt_records,
    amount: parseNumber(e.amount),
    tax_amount: parseNumber(e.tax_amount),
    total_amount: parseNumber(e.total_amount),
    mileage_rate: parseNumber(e.mileage_rate),
    exchange_rate: parseNumber(e.exchange_rate),
    amount_paid: undefined,
    companies_expenses_vendor_idTocompanies: undefined,
    profiles_expenses_created_byToprofiles: undefined,
    profiles_expenses_approved_byToprofiles: undefined,
    profiles_expenses_reimbursed_toToprofiles: undefined,
    receipt_records: undefined,
  };
}

export const receiptInclude = {
  expenses: { select: { id: true, expense_number: true, description: true } },
  invoices: { select: { id: true, package_code: true, title: true } },
  profiles: { select: { id: true, first_name: true, last_name: true, email: true } },
  companies: { select: { id: true, name: true } },
} as const;

export type ReceiptWithRelations = Prisma.receiptsGetPayload<{
  include: typeof receiptInclude;
}>;

export function mapReceipt(receipt: ReceiptWithRelations) {
  const r = receipt as unknown as Record<string, unknown>;
  return {
    ...r,
    expense: r.expenses,
    invoice: r.invoices,
    uploader: r.profiles,
    vendor: r.companies,
    subtotal: parseNumber(r.subtotal),
    tax_amount: parseNumber(r.tax_amount),
    total_amount: parseNumber(r.total_amount),
    ocr_confidence: parseNumber(r.ocr_confidence),
    expenses: undefined,
    invoices: undefined,
    profiles: undefined,
    companies: undefined,
  };
}

export function mapPayment(payment: Record<string, unknown> & { invoices?: Record<string, unknown> | null; crm_projects?: Record<string, unknown> | null }) {
  const formatted: Record<string, unknown> = { ...payment };
  formatted.amount = parseNumber(payment.amount);
  formatted.gateway_fee = parseNumber(payment.gateway_fee);
  formatted.refunded_amount = parseNumber(payment.refunded_amount);
  formatted.payment_date = payment.payment_date || payment.created_at;
  if (payment.invoices) {
    const inv = payment.invoices;
    formatted.invoice = {
      id: inv.id,
      invoice_number: inv.package_code,
      title: inv.title,
      client_name: inv.client_name,
      client_company: inv.client_company,
      total: parseNumber(inv.total_amount),
      currency: inv.currency || 'AUD',
    };
  }
  if (payment.crm_projects) {
    formatted.project = payment.crm_projects;
  }
  return formatted;
}

export function parseDateOnly(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export function asDocumentType(value?: string): document_type_enum | undefined {
  if (!value) return undefined;
  return value as document_type_enum;
}

export function parseLineItems(value: unknown): { name: string; description: string; quantity: number; unit_price: number; total: number }[] {
  let arr: unknown[] = [];
  if (!value) return arr as [];
  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      arr = [];
    }
  }
  return arr.map((item) => {
    const it = (item as Record<string, unknown>) || {};
    const qty = parseNumber(it.quantity) || 1;
    const price = parseNumber(it.unit_price);
    return {
      name: typeof it.name === 'string' ? it.name : '',
      description: typeof it.description === 'string' ? it.description : '',
      quantity: qty,
      unit_price: price,
      total: parseNumber(it.total) || qty * price,
    };
  });
}

function normalizeInvoiceFields(plain: Record<string, unknown>) {
  const lineItems = parseLineItems(plain.line_items ?? plain.items);
  const totalAmount = parseNumber(plain.total_amount) || parseNumber(plain.total) || 0;
  const amountPaid = parseNumber(plain.amount_paid);
  const subtotalAmount = parseNumber(plain.subtotal);
  const taxAmount = parseNumber(plain.tax_amount);
  const discountAmount = parseNumber(plain.discount_amount) || parseNumber(plain.discount_value);

  return {
    ...plain,
    invoice_number: plain.package_code || plain.invoice_number,
    package_code: plain.package_code,
    total: totalAmount,
    total_amount: totalAmount,
    subtotal: subtotalAmount,
    tax_rate: parseNumber(plain.tax_rate) || 10,
    tax_amount: taxAmount,
    tax_type: plain.tax_type || 'gst_included',
    template_type: plain.template_type || 'tax_excluded',
    discount_amount: discountAmount,
    discount_value: discountAmount,
    amount_paid: amountPaid,
    amount_due: Math.max(0, totalAmount - amountPaid),
    type: plain.document_type || plain.type || 'invoice',
    document_type: plain.document_type || plain.type || 'invoice',
    items: lineItems,
    line_items: lineItems,
  };
}

export const invoiceInclude = {
  companies: { select: { id: true, name: true } },
  contacts: { select: { id: true, name: true, email: true } },
  profiles: { select: { id: true, first_name: true, last_name: true, email: true } },
  crm_projects_invoices_crm_project_idTocrm_projects: { select: { id: true, name: true, project_number: true } },
  crm_subprojects: { select: { id: true, name: true } },
  payment_records: true,
  receipt_records: { select: { id: true, receipt_number: true, file_name: true, file_url: true } },
} as const;

export type InvoiceWithRelations = Prisma.invoicesGetPayload<{ include: typeof invoiceInclude }>;

export function mapInvoice(invoice: InvoiceWithRelations, includePayments = false) {
  const plain = invoice as unknown as Record<string, unknown>;
  const normalized = normalizeInvoiceFields(plain) as Record<string, unknown>;

  if (plain.companies) normalized.company = plain.companies;
  if (plain.contacts) normalized.contact = plain.contacts;
  if (plain.profiles) normalized.creator = plain.profiles;
  if (plain.crm_projects_invoices_crm_project_idTocrm_projects) {
    normalized.crmProject = plain.crm_projects_invoices_crm_project_idTocrm_projects;
  }
  if (plain.crm_subprojects) normalized.crmSubproject = plain.crm_subprojects;

  if (includePayments && Array.isArray(plain.payment_records)) {
    normalized.payments = (plain.payment_records as Record<string, unknown>[]).map((p) => ({
      id: p.id,
      amount: parseNumber(p.amount),
      payment_method: p.payment_method,
      payment_date: p.payment_date || p.created_at,
      transaction_id: p.transaction_id,
      notes: p.notes,
      status: p.status,
    }));
  }

  return normalized;
}

export function buildInvoiceListEnvelope(
  rows: InvoiceWithRelations[],
  total: number,
  page: number,
  limit: number,
) {
  const items = rows.map((r) => mapInvoice(r));
  return {
    packages: items,
    data: items,
    invoices: items,
    total,
    page,
    totalPages: total > 0 ? Math.ceil(total / limit) : 1,
    pagination: {
      total,
      page,
      pages: total > 0 ? Math.ceil(total / limit) : 1,
      limit,
    },
  };
}
