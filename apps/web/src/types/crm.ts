import { Company as SharedCompany } from '@clickbit/shared';

export type UserRole = 'admin' | 'manager' | 'employee' | 'customer' | 'agent';

export interface User {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  role?: UserRole | string;
  status?: string;
  avatar?: string | null;
  job_title?: string | null;
  phone?: string | null;
  created_at?: string;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface OffsetPagination {
  total: number;
  limit: number;
  offset: number;
}

export interface Company extends SharedCompany {
  owner?: { id: number; first_name: string; last_name: string } | null;
  primary_contact?: { id: number; name: string; email: string; phone?: string | null } | null;
  effective_email?: string | null;
  effective_phone?: string | null;
  deals?: unknown[];
  activities?: unknown[];
  notes?: unknown[];
  contactAssociations?: { contact: { id: number; name: string; email?: string; phone?: string } }[];
  total_projects?: number;
  total_tasks?: number;
}

export interface CrmContact {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  company_id?: number | null;
  primary_company?: Company | null;
  lifecycle_stage?: string;
  lead_status?: string;
  lead_score?: number;
  contact_type?: string;
  status?: string;
  priority?: string;
  source?: string;
  owner_id?: number | null;
  owner?: User | null;
  assignedUser?: User | null;
  user_id?: number | null;
  total_revenue?: number;
  became_customer_at?: string | null;
  last_contacted_at?: string | null;
  commission_type?: 'none' | 'percentage' | 'fixed_amount';
  commission_rate?: number;
  client_count?: number;
  client_revenue?: number;
  created_at?: string;
  updated_at?: string;
  effective_email?: string | null;
  effective_phone?: string | null;
  job_title?: string | null;
  department?: string | null;
  website?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  preferred_contact_method?: string | null;
  date_of_birth?: string | null;
}

export interface PipelineStage {
  id: number;
  pipeline_id: number;
  name: string;
  position: number;
  color?: string;
  probability?: number;
  is_won?: boolean;
  is_lost?: boolean;
  is_active?: boolean;
  leads?: CrmLead[];
  deals?: Deal[];
}

export interface Pipeline {
  id: number;
  name: string;
  currency?: string;
  is_default?: boolean;
  is_active?: boolean;
  stages?: PipelineStage[];
}

export interface CrmLead {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  lead_number?: string;
  company_id?: number | null;
  company_name?: string | null;
  company?: Company | null;
  job_title?: string | null;
  pipeline_id?: number | null;
  pipeline?: Pipeline | null;
  stage_id?: number | null;
  stage?: PipelineStage | null;
  owner_id?: number | null;
  owner?: User | null;
  status?: 'open' | 'won' | 'lost' | string;
  estimated_value?: number | string;
  currency?: string;
  lead_score?: number;
  lead_source?: string;
  priority?: string;
  expected_close_date?: string | null;
  description?: string | null;
  position?: number;
  created_at?: string;
  updated_at?: string;
  type?: 'lead';
}

export interface Deal {
  id: number;
  title: string;
  deal_number?: string;
  description?: string | null;
  value?: number | string;
  currency?: string;
  pipeline_id?: number | null;
  pipeline?: Pipeline | null;
  stage_id?: number | null;
  stage?: PipelineStage | null;
  contact_id?: number | null;
  primaryContact?: CrmContact | null;
  contact?: CrmContact | null;
  company_id?: number | null;
  company?: Company | null;
  owner_id?: number | null;
  owner?: User | null;
  status?: 'open' | 'won' | 'lost' | string;
  priority?: string;
  probability?: number;
  expected_close_date?: string | null;
  actual_close_date?: string | null;
  lead_source?: string;
  position?: number;
  created_at?: string;
  updated_at?: string;
  type?: 'deal';
}

export interface DealStageHistoryItem {
  id: number;
  deal_id: number;
  from_stage_id?: number | null;
  fromStage?: PipelineStage | null;
  to_stage_id?: number | null;
  toStage?: PipelineStage | null;
  changed_by?: number;
  changedBy?: User | null;
  note?: string;
  created_at?: string;
}

export interface DealDetail extends Deal {
  order?: unknown;
  invoice?: unknown;
  activities?: Activity[];
  notes?: Note[];
  stageHistory?: DealStageHistoryItem[];
  contactAssociations?: { contact: CrmContact }[];
}

export interface Activity {
  id: number;
  activity_type: string;
  subject: string;
  description?: string | null;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'overdue' | string;
  priority?: string;
  due_date?: string | null;
  completed_at?: string | null;
  owner_id?: number | null;
  owner?: User | null;
  assigned_to?: number | null;
  assignee?: User | null;
  contact_id?: number | null;
  contact?: CrmContact | null;
  company_id?: number | null;
  company?: Company | null;
  deal_id?: number | null;
  deal?: Deal | null;
  project_id?: number | null;
  crm_project_id?: number | null;
  created_at?: string;
  outcome?: string;
}

export interface Note {
  id: number;
  content: string;
  note_type?: string;
  is_pinned?: boolean;
  contact_id?: number | null;
  company_id?: number | null;
  deal_id?: number | null;
  project_id?: number | null;
  created_by?: number;
  creator?: User | null;
  created_at?: string;
}

export interface ProjectTask {
  id: number;
  title: string;
  description?: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked' | string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string;
  assigned_to?: number | null;
  assignee?: User | null;
  created_by?: number | null;
  creator?: User | null;
  estimated_hours?: number | string;
  actual_hours?: number | string;
  due_date?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  position?: number;
  parent_task_id?: number | null;
  crm_project_id?: number | null;
  crmProject?: { id: number; name?: string; project_number?: string } | null;
  subproject_id?: number | null;
  subproject?: { id: number; name: string } | null;
  project?: { id: number; title?: string; deal_number?: string } | null;
  customer?: CrmContact | null;
  tags?: string[];
  subtasks?: ProjectTask[];
  created_at?: string;
}

export interface TaskStats {
  total: number;
  todo: number;
  in_progress: number;
  review: number;
  completed: number;
  blocked: number;
  totalEstimatedHours?: number;
  totalActualHours?: number;
}

export interface ProjectStats {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  onHold: number;
  cancelled: number;
}

export interface CrmProjectFinancials {
  totalValue: number;
  totalPaid: number;
  totalExpenses: number;
  labourCost: number;
  totalCosts: number;
  totalPaymentsReceived: number;
  netProfit: number;
  invoiceCount: number;
  estimateCount: number;
  expenseCount: number;
  ticketCount: number;
  taskCount: number;
}

export interface CrmProject {
  id: number;
  name: string;
  project_number?: string;
  description?: string | null;
  status: 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' | string;
  priority?: string;
  budget?: number | string;
  currency?: string;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  progress_percentage?: number;
  actual_hours?: number | string;
  estimated_hours?: number | string;
  hourly_rate?: number | string;
  company_id?: number | null;
  company?: Company | null;
  customer_id?: number | null;
  customer?: CrmContact | null;
  deal_id?: number | null;
  deal?: Deal | null;
  manager_id?: number | null;
  manager?: User | null;
  created_by?: number | null;
  creator?: User | null;
  project_type?: string | null;
  support_period_type?: string | null;
  support_start_date?: string | null;
  support_end_date?: string | null;
  support_price?: number | string;
  support_currency?: string;
  subproject_count?: number;
  task_count?: number;
  tasks?: ProjectTask[];
  subprojects?: CrmSubproject[];
  invoices?: unknown[];
  expenses?: unknown[];
  tickets?: unknown[];
  payments?: unknown[];
  documents?: ProjectDocument[];
  meetings?: ProjectMeeting[];
  financials?: CrmProjectFinancials;
  created_at?: string;
}

export interface CrmSubproject {
  id: number;
  parent_project_id?: number;
  name: string;
  description?: string | null;
  status?: 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' | string;
  progress_percentage?: number;
  priority?: string;
  budget?: number | string;
  actual_cost?: number | string;
  currency?: string;
  start_date?: string | null;
  due_date?: string | null;
  completed_date?: string | null;
  estimated_hours?: number | string;
  actual_hours?: number | string;
  hourly_rate?: number | string;
  manager_id?: number | null;
  manager?: User | null;
  created_by?: number | null;
  creator?: User | null;
  support_period_type?: string | null;
  support_start_date?: string | null;
  support_end_date?: string | null;
  support_price?: number | string;
  support_currency?: string;
  support_notes?: string | null;
  task_count?: number;
  completed_task_count?: number;
  documents?: ProjectDocument[];
  invoices?: unknown[];
  created_at?: string;
  updated_at?: string;
}

export interface ProjectDocument {
  id: number;
  file_name: string;
  file_url?: string | null;
  file_size?: number;
  file_type?: string | null;
  uploaded_by?: number | null;
  uploader?: User | null;
  created_at?: string;
}

export interface ProjectMeeting {
  id: number;
  crm_project_id?: number;
  title: string;
  meeting_date?: string;
  duration_minutes?: number;
  participants?: string | null;
  notes?: string | null;
  status?: string;
  created_by?: number | null;
  creator?: User | null;
  created_at?: string;
}

export interface ValueBreakdownItem {
  type: 'invoice' | 'deal' | 'project';
  id: number;
  reference?: string;
  description: string;
  amount: number;
  currency: string;
  status?: string;
  date?: string | null;
}

export interface ValueBreakdownResponse {
  company_id: number;
  company_name: string;
  total: number;
  currency: string;
  breakdown: ValueBreakdownItem[];
  counts: {
    invoices: number;
    deals: number;
    projects: number;
  };
}

export interface Invoice {
  id: number;
  package_code?: string;
  invoice_number?: string;
  title?: string;
  total_amount?: number | string;
  amount_paid?: number | string;
  status?: string;
  document_type?: string;
  issue_date?: string;
  due_date?: string;
  created_at?: string;
}

export interface Payment {
  id: number;
  transaction_id?: string;
  amount?: number | string;
  status?: string;
  payment_method?: string;
  payment_date?: string;
  created_at?: string;
  invoice?: Invoice;
}

export interface Document {
  id: number;
  title?: string;
  original_filename?: string;
  file_name?: string;
  file_url?: string;
  file_size?: number;
  mime_type?: string;
  storage_key?: string;
  category?: string;
  status?: string;
  source?: string;
  created_at?: string;
  uploaded_by?: User;
}

export interface ContactStats {
  total: number;
  totalRevenue: number;
  avgRevenue: number;
  newThisMonth: number;
  activeCustomers: number;
}

export interface OrderItem {
  id: number;
  product_name?: string;
  quantity?: number;
  unit_price?: number | string;
  total_price?: number | string;
  status?: string;
  created_at?: string;
}

export interface Order {
  id: number;
  order_number?: string;
  status?: string;
  payment_status?: string;
  subtotal?: number | string;
  tax_amount?: number | string;
  shipping_amount?: number | string;
  discount_amount?: number | string;
  total_amount?: number | string;
  currency?: string;
  customer_notes?: string;
  admin_notes?: string;
  estimated_delivery?: string;
  shipped_at?: string;
  delivered_at?: string;
  order_items?: OrderItem[];
  created_at?: string;
}
