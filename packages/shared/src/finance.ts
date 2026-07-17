export interface InvoiceLineItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total?: number;
}

export interface Invoice {
  id: number;
  package_code?: string;
  invoice_number?: string;
  client_name: string;
  client_email: string;
  client_phone?: string | null;
  client_company?: string | null;
  title: string;
  description?: string | null;
  type?: string;
  document_type?: string;
  template_type?: string;
  status?: string;
  payment_status?: string;
  line_items?: InvoiceLineItem[];
  items?: InvoiceLineItem[];
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  tax_type?: string;
  discount_amount?: number;
  discount_value?: number;
  total_amount?: number;
  total?: number;
  amount_paid?: number;
  amount_due?: number;
  currency?: string;
  terms?: string | null;
  notes?: string | null;
  client_notes?: string | null;
  valid_until?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  paid_at?: string | null;
  source_type?: string | null;
  source_id?: number | null;
  contact_id?: number | null;
  company_id?: number | null;
  crm_project_id?: number | null;
  crm_subproject_id?: number | null;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  payments?: Record<string, unknown>[];
  company?: { id: number; name: string } | null;
  contact?: { id: number; name: string; email?: string } | null;
  creator?: { id: number; first_name?: string; last_name?: string; email?: string } | null;
  crmProject?: { id: number; name: string; project_number?: string } | null;
  crmSubproject?: { id: number; name: string } | null;
}

export interface InvoiceListResponse {
  packages: Invoice[];
  data: Invoice[];
  invoices: Invoice[];
  total: number;
  page: number;
  totalPages: number;
  pagination: { total: number; page: number; pages: number; limit: number };
}

export interface Payment {
  id: number;
  transaction_id?: string;
  invoice_id?: number | null;
  amount: number;
  currency?: string;
  payment_provider?: string;
  payment_method?: string;
  status?: string;
  payment_date?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  notes?: string | null;
  gateway_fee?: number;
  gateway_response?: string | null;
  gateway_error?: string | null;
  refunded_amount?: number;
  refunded_at?: string | null;
  refunded_reason?: string | null;
  billing_address?: string | null;
  payment_details?: string | null;
  processed_at?: string | null;
  failed_at?: string | null;
  retry_count?: number;
  next_retry_at?: string | null;
  invoice?: Invoice | null;
  project?: { id: number; name: string; project_number?: string } | null;
}

export interface PaymentListResponse {
  payments: Payment[];
  pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number };
}

export interface ExpenseLineItem {
  description: string;
  amount: number;
}

export interface Expense {
  id: number;
  expense_number?: string;
  description?: string;
  category?: string;
  status?: string;
  amount?: number;
  tax_amount?: number;
  total_amount?: number;
  currency?: string;
  expense_date?: string;
  payment_method?: string;
  vendor_id?: number | null;
  vendor?: { id: number; name: string } | null;
  employee_id?: number | null;
  employee?: Record<string, unknown> | null;
  created_by?: number;
  creator?: { id: number; first_name?: string; last_name?: string; email?: string } | null;
  approved_by?: number | null;
  approver?: { id: number; first_name?: string; last_name?: string } | null;
  reimbursed_to?: number | null;
  reimbursedToUser?: { id: number; first_name?: string; last_name?: string } | null;
  is_billable?: boolean;
  is_reimbursable?: boolean;
  notes?: string | null;
  invoice_id?: number | null;
  invoice?: { id: number; package_code?: string; title?: string } | null;
  deal?: { id: number; title: string } | null;
  crm_project_id?: number | null;
  crmProject?: { id: number; name: string; project_number?: string } | null;
  crm_subproject_id?: number | null;
  crmSubproject?: { id: number; name: string } | null;
  receipt_ids?: number[];
  linkedReceipts?: Record<string, unknown>[];
  receipts?: { id: number; file_name: string; file_url?: string | null; total_amount?: number }[];
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}
