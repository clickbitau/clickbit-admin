import axios from 'axios';
import { CompaniesListResponse } from '@clickbit/shared';
import type {
  Activity,
  Company,
  ContactStats,
  CrmContact,
  CrmLead,
  CrmProject,
  Deal,
  DealDetail,
  Document,
  Pipeline,
  PipelineStage,
  ProjectTask,
  ProjectStats,
  TaskStats,
  User,
  ValueBreakdownResponse,
} from '@/types/crm';
import type { Expense, Invoice, InvoiceListResponse, Payment, PaymentListResponse } from '@/types/finance';
import type { Announcement, Employee, HrDashboardData, PublicHoliday, Reminder, TimeOffRequest } from '@/types/hr';
import type {
  AdminTicketListResponse,
  CannedResponse,
  CustomerRepository,
  CustomerTicketListResponse,
  StaffTicketListResponse,
  SupportStaff,
  Ticket,
  TicketMessage,
  TicketReplyResponse,
  TicketStats,
  TicketQuota,
} from '@/types/support';
import type {
  CachedEmail,
  Channel,
  CommunicationLegacyDataResponse,
  CommunicationLegacyListResponse,
  CommunicationLegacyMessageResponse,
  DirectMessage,
  EmailTemplate,
  MailAccount,
  MailFolder,
  Message,
  MessageEnvelope,
  MessageListResponse,
  Workspace,
} from '@/types/communication';
import type {
  BlogPost,
  Comment,
  ContentLegacyDataResponse,
  ContentLegacyListResponse,
  ContentLegacyMessageResponse,
  PortfolioItem,
  Review,
  Service,
  TeamMember,
} from '@/types/content';

export const api = axios.create({
  baseURL: '/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}
function extractSingle<T>(response: { data: unknown }, key: string): T {
  const d = response.data as any;
  if (d && typeof d === 'object') {
    if (key in d && d[key] !== undefined) return d[key] as T;
    if ('data' in d) return d.data as T;
  }
  return d as T;
}

function extractList<T>(response: { data: unknown }, key: string): T[] {
  const d = response.data as any;
  if (d && typeof d === 'object') {
    if (key in d && Array.isArray(d[key])) return d[key] as T[];
  }
  if (Array.isArray(d)) return d as T[];
  return [];
}


// ─── Companies ─────────────────────────────────────────────────────────────

export async function fetchCompanies(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<CompaniesListResponse> {
  const response = await api.get<CompaniesListResponse>('/api/crm/companies', {
    params,
    headers: authHeaders(token),
  });
  return response.data;
}

export async function fetchCompany(token: string, id: string | number): Promise<Company> {
  const response = await api.get<Company>(`/api/crm/companies/${id}`, {
    headers: authHeaders(token),
  });
  return response.data;
}

export async function updateCompany(
  token: string,
  id: string | number,
  data: Partial<Company>,
): Promise<Company> {
  const response = await api.put<Company>(`/api/crm/companies/${id}`, data, {
    headers: authHeaders(token),
  });
  return response.data;
}

export async function deleteCompany(token: string, id: string | number): Promise<void> {
  await api.delete(`/api/crm/companies/${id}`, { headers: authHeaders(token) });
}

export async function fetchCompanyUsers(token: string, id: string | number): Promise<User[]> {
  const response = await api.get<{ users: User[] }>(`/api/crm/companies/${id}/users`, {
    headers: authHeaders(token),
  });
  return response.data.users ?? [];
}

export async function fetchCompanyInvoices(
  token: string,
  id: string | number,
  params?: Record<string, string | number | boolean>,
) {
  const response = await api.get<{ invoices: Invoice[]; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } }>(
    `/api/crm/companies/${id}/invoices`,
    { params, headers: authHeaders(token) },
  );
  return response.data;
}

export async function fetchCompanyPayments(
  token: string,
  id: string | number,
  params?: Record<string, string | number | boolean>,
) {
  const response = await api.get<{ payments: Payment[]; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } }>(
    `/api/crm/companies/${id}/payments`,
    { params, headers: authHeaders(token) },
  );
  return response.data;
}

export async function fetchCompanyValueBreakdown(
  token: string,
  id: string | number,
): Promise<ValueBreakdownResponse> {
  const response = await api.get<ValueBreakdownResponse>(`/api/crm/companies/${id}/value-breakdown`, {
    headers: authHeaders(token),
  });
  return response.data;
}

export async function fetchCompanyDocuments(
  token: string,
  id: string | number,
  params?: Record<string, string | number | boolean>,
) {
  const response = await api.get<{
    documents: Document[];
    subprojectDocuments: Document[];
    company: { id: number; name: string };
    pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number };
  }>(`/api/crm/companies/${id}/documents`, { params, headers: authHeaders(token) });
  return response.data;
}

// ─── Users / Team ────────────────────────────────────────────────────────────

export async function fetchTeam(token: string): Promise<User[]> {
  const response = await api.get<User[]>('/api/users/team', { headers: authHeaders(token) });
  return extractList<User>(response, 'users');
}

// ─── Pipelines ───────────────────────────────────────────────────────────────

export async function fetchPipelines(token: string): Promise<Pipeline[]> {
  const response = await api.get<Pipeline[]>('/api/crm/pipelines', { headers: authHeaders(token) });
  return extractList<Pipeline>(response, 'pipelines');
}

export async function fetchPipeline(token: string, id: string | number): Promise<Pipeline> {
  const response = await api.get<Pipeline>(`/api/crm/pipelines/${id}`, { headers: authHeaders(token) });
  return extractSingle<Pipeline>(response, 'pipeline');
}

export async function fetchPipelineBoard(
  token: string,
  id: string | number,
  status?: string,
): Promise<{ pipeline: Pipeline; stages: PipelineStage[]; stats: { totalLeads: number; totalDeals: number; totalValue: number; weightedValue: number } }> {
  const response = await api.get(`/api/crm/leads/pipeline/${id}`, {
    params: status ? { status } : undefined,
    headers: authHeaders(token),
  });
  return response.data;
}


// ─── Deals ───────────────────────────────────────────────────────────────────

export async function fetchDeals(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ deals: Deal[]; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } }> {
  const response = await api.get('/api/crm/deals', { params, headers: authHeaders(token) });
  return response.data;
}

export async function fetchDeal(token: string, id: string | number): Promise<DealDetail> {
  const response = await api.get<{ deal: DealDetail }>(`/api/crm/deals/${id}`, {
    headers: authHeaders(token),
  });
  return extractSingle<DealDetail>(response, 'deal');
}

export async function createDeal(token: string, data: Partial<Deal>): Promise<Deal> {
  const response = await api.post<{ deal: Deal }>('/api/crm/deals', data, {
    headers: authHeaders(token),
  });
  return extractSingle<Deal>(response, 'deal');
}

export async function updateDeal(token: string, id: string | number, data: Partial<Deal>): Promise<Deal> {
  const response = await api.put<{ deal: Deal }>(`/api/crm/deals/${id}`, data, {
    headers: authHeaders(token),
  });
  return extractSingle<Deal>(response, 'deal');
}

export async function moveDeal(
  token: string,
  id: string | number,
  data: { stage_id: number; position?: number },
): Promise<Deal> {
  const response = await api.put<{ deal: Deal }>(`/api/crm/deals/${id}/move`, data, {
    headers: authHeaders(token),
  });
  return extractSingle<Deal>(response, 'deal');
}

export async function markDealWon(token: string, id: string | number, data?: { reason?: string }): Promise<Deal> {
  const response = await api.put<{ deal: Deal }>(`/api/crm/deals/${id}/won`, data ?? {}, {
    headers: authHeaders(token),
  });
  return extractSingle<Deal>(response, 'deal');
}

export async function markDealLost(
  token: string,
  id: string | number,
  data?: { reason?: string; competitor?: string },
): Promise<Deal> {
  const response = await api.put<{ deal: Deal }>(`/api/crm/deals/${id}/lost`, data ?? {}, {
    headers: authHeaders(token),
  });
  return extractSingle<Deal>(response, 'deal');
}

export async function reopenDeal(token: string, id: string | number): Promise<Deal> {
  const response = await api.put<{ deal: Deal }>(`/api/crm/deals/${id}/reopen`, {}, {
    headers: authHeaders(token),
  });
  return extractSingle<Deal>(response, 'deal');
}

export async function deleteDeal(token: string, id: string | number): Promise<void> {
  await api.delete(`/api/crm/deals/${id}`, { headers: authHeaders(token) });
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export async function fetchLeads(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ leads: CrmLead[]; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } }> {
  const response = await api.get('/api/crm/leads', { params, headers: authHeaders(token) });
  return response.data;
}

export async function fetchLead(token: string, id: string | number): Promise<CrmLead> {
  const response = await api.get<{ lead: CrmLead }>(`/api/crm/leads/${id}`, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmLead>(response, 'lead');
}

export async function createLead(token: string, data: Partial<CrmLead>): Promise<CrmLead> {
  const response = await api.post<{ lead: CrmLead }>('/api/crm/leads', data, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmLead>(response, 'lead');
}

export async function updateLead(token: string, id: string | number, data: Partial<CrmLead>): Promise<CrmLead> {
  const response = await api.put<{ lead: CrmLead }>(`/api/crm/leads/${id}`, data, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmLead>(response, 'lead');
}

export async function moveLead(
  token: string,
  id: string | number,
  data: { stage_id: number; position?: number },
): Promise<CrmLead> {
  const response = await api.patch<{ lead: CrmLead }>(`/api/crm/leads/${id}/move`, data, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmLead>(response, 'lead');
}

export async function winLead(
  token: string,
  id: string | number,
  data?: { reason?: string; create_deal?: boolean; deal_title?: string },
): Promise<{ lead: CrmLead; customer?: CrmContact; deal?: Deal }> {
  const response = await api.post(`/api/crm/leads/${id}/win`, data ?? {}, {
    headers: authHeaders(token),
  });
  return response.data;
}

export async function loseLead(
  token: string,
  id: string | number,
  data?: { reason?: string; competitor?: string },
): Promise<CrmLead> {
  const response = await api.post<{ lead: CrmLead }>(`/api/crm/leads/${id}/lose`, data ?? {}, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmLead>(response, 'lead');
}

export async function deleteLead(token: string, id: string | number): Promise<void> {
  await api.delete(`/api/crm/leads/${id}`, { headers: authHeaders(token) });
}

export async function recalculateLeadScores(token: string): Promise<unknown> {
  const response = await api.post('/api/crm/leads/recalculate-scores', {}, { headers: authHeaders(token) });
  return response.data;
}

export async function autoAssignLeads(token: string, contactIds?: number[]): Promise<{ assigned_count: number }> {
  const response = await api.post('/api/crm/leads/auto-assign', { contact_ids: contactIds }, {
    headers: authHeaders(token),
  });
  return response.data;
}

export async function fetchHotLeads(token: string): Promise<CrmLead[]> {
  const response = await api.get<CrmLead[]>('/api/crm/leads/hot', { headers: authHeaders(token) });
  return extractList<CrmLead>(response, 'leads');
}

export async function fetchUncontactedLeads(token: string, days = 7): Promise<CrmLead[]> {
  const response = await api.get<CrmLead[]>(`/api/crm/leads/uncontacted`, { params: { days }, headers: authHeaders(token) });
  return extractList<CrmLead>(response, 'leads');
}

export async function updateLeadScore(token: string, id: string | number, score: number): Promise<{ lead_score: number }> {
  const response = await api.put(`/api/crm/contacts/${id}/lead-score`, { lead_score: score }, {
    headers: authHeaders(token),
  });
  return response.data;
}

// ─── Contacts / Customers / Agents ────────────────────────────────────────────

export async function fetchContacts(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ contacts: CrmContact[]; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } }> {
  const response = await api.get('/api/admin/contacts', { params, headers: authHeaders(token) });
  return response.data;
}

export async function fetchContact(token: string, id: string | number): Promise<CrmContact> {
  const response = await api.get<{ data: CrmContact }>(`/api/crm/contacts/${id}`, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmContact>(response, 'data');
}

export async function updateContact(token: string, id: string | number, data: Partial<CrmContact>): Promise<CrmContact> {
  const response = await api.put<{ data: CrmContact }>(`/api/crm/contacts/${id}`, data, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmContact>(response, 'data');
}

export async function deleteContact(token: string, id: string | number): Promise<void> {
  await api.delete(`/api/crm/contacts/${id}`, { headers: authHeaders(token) });
}

export async function fetchCustomerStats(token: string): Promise<ContactStats> {
  const response = await api.get<ContactStats>('/api/admin/contacts/customer-stats', {
    headers: authHeaders(token),
  });
  return extractSingle<ContactStats>(response, 'data');
}

export async function fetchAgents(token: string): Promise<CrmContact[]> {
  const response = await api.get<{ success: boolean; data: CrmContact[] }>('/api/admin/contacts/agents', {
    headers: authHeaders(token),
  });
  return extractList<CrmContact>(response, 'data');
}

export async function fetchAgentClients(token: string, id: string | number): Promise<Company[]> {
  const response = await api.get<{ success: boolean; data: Company[] }>(`/api/admin/contacts/${id}/clients`, {
    headers: authHeaders(token),
  });
  return extractList<Company>(response, 'data');
}

export async function updateAgentCommission(
  token: string,
  id: string | number,
  data: { commission_type: 'none' | 'percentage' | 'fixed_amount'; commission_rate: number },
): Promise<{ success: boolean; data: { commission_type: string; commission_rate: number } }> {
  const response = await api.put(`/api/admin/contacts/${id}/commission`, data, {
    headers: authHeaders(token),
  });
  return response.data;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function fetchProjects(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ projects: CrmProject[]; stats: ProjectStats; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } }> {
  const response = await api.get('/api/crm/projects-new', { params, headers: authHeaders(token) });
  return response.data;
}

export async function fetchProject(token: string, id: string | number): Promise<CrmProject> {
  const response = await api.get<{ project: CrmProject }>(`/api/crm/projects-new/${id}`, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmProject>(response, 'project');
}

export async function createProject(token: string, data: Partial<CrmProject>): Promise<CrmProject> {
  const response = await api.post<{ project: CrmProject }>('/api/crm/projects-new', data, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmProject>(response, 'project');
}

export async function updateProject(token: string, id: string | number, data: Partial<CrmProject>): Promise<CrmProject> {
  const response = await api.put<{ project: CrmProject }>(`/api/crm/projects-new/${id}`, data, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmProject>(response, 'project');
}

export async function updateProjectStatus(
  token: string,
  id: string | number,
  data: { status?: string; progress_percentage?: number },
): Promise<CrmProject> {
  const response = await api.patch<{ project: CrmProject }>(`/api/crm/projects-new/${id}/status`, data, {
    headers: authHeaders(token),
  });
  return extractSingle<CrmProject>(response, 'project');
}

export async function deleteProject(token: string, id: string | number): Promise<void> {
  await api.delete(`/api/crm/projects-new/${id}`, { headers: authHeaders(token) });
}

export async function fetchProjectTasks(
  token: string,
  projectId: string | number,
  params?: Record<string, string | number | boolean>,
): Promise<{ tasks: ProjectTask[]; stats: { total: number; todo: number; in_progress: number; review: number; completed: number; blocked: number; totalEstimatedHours?: number; totalActualHours?: number } }> {
  const response = await api.get(`/api/crm/projects-new/${projectId}/tasks`, {
    params,
    headers: authHeaders(token),
  });
  return response.data;
}

export async function createProjectTask(
  token: string,
  projectId: string | number,
  data: Partial<ProjectTask>,
): Promise<ProjectTask> {
  const response = await api.post(`/api/crm/projects-new/${projectId}/tasks`, data, {
    headers: authHeaders(token),
  });
  return extractSingle<ProjectTask>(response, 'data');
}

// ─── Tasks (standalone / all projects) ───────────────────────────────────────

export async function fetchTasks(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ data: ProjectTask[]; stats: TaskStats; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } }> {
  const response = await api.get('/api/tasks', { params, headers: authHeaders(token) });
  return response.data;
}

export async function fetchTask(token: string, id: string | number): Promise<ProjectTask> {
  const response = await api.get<{ success: boolean; data: ProjectTask }>(`/api/tasks/${id}`, { headers: authHeaders(token) });
  return extractSingle<ProjectTask>(response, 'data');
}

export async function updateTask(token: string, id: string | number, data: Partial<ProjectTask>): Promise<ProjectTask> {
  const response = await api.put<{ success: boolean; data: ProjectTask }>(`/api/tasks/${id}`, data, { headers: authHeaders(token) });
  return extractSingle<ProjectTask>(response, 'data');
}

export async function deleteTask(token: string, id: string | number): Promise<void> {
  await api.delete(`/api/tasks/${id}`, { headers: authHeaders(token) });
}

export async function updateTaskStatus(
  token: string,
  taskId: string | number,
  data: { status: string; actual_hours?: number | string },
): Promise<ProjectTask> {
  const response = await api.patch<{ data: ProjectTask }>(`/api/projects/tasks/${taskId}/status`, data, {
    headers: authHeaders(token),
  });
  return extractSingle<ProjectTask>(response, 'data');
}

export async function fetchAssignees(token: string): Promise<User[]> {
  const response = await api.get<{ success: boolean; data: User[] }>('/api/projects/tasks/assignees', {
    headers: authHeaders(token),
  });
  return response.data.data ?? [];
}


// ─── Activities ───────────────────────────────────────────────────────────────

export async function fetchActivities(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ activities: Activity[]; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } }> {
  const response = await api.get('/api/crm/activities', { params, headers: authHeaders(token) });
  return response.data;
}

export async function fetchActivity(token: string, id: string | number): Promise<Activity> {
  const response = await api.get<Activity>(`/api/crm/activities/${id}`, { headers: authHeaders(token) });
  return extractSingle<Activity>(response, 'activity');
}

export async function createActivity(token: string, data: Partial<Activity>): Promise<Activity> {
  const response = await api.post('/api/crm/activities', data, { headers: authHeaders(token) });
  return extractSingle<Activity>(response, 'activity');
}

export async function updateActivity(token: string, id: string | number, data: Partial<Activity>): Promise<Activity> {
  const response = await api.put(`/api/crm/activities/${id}`, data, { headers: authHeaders(token) });
  return extractSingle<Activity>(response, 'activity');
}

export async function completeActivity(token: string, id: string | number, outcome?: string): Promise<Activity> {
  const response = await api.put(`/api/crm/activities/${id}/complete`, { outcome }, { headers: authHeaders(token) });
  return extractSingle<Activity>(response, 'activity');
}

export async function deleteActivity(token: string, id: string | number): Promise<void> {
  await api.delete(`/api/crm/activities/${id}`, { headers: authHeaders(token) });
}

// ─── Finance ───────────────────────────────────────────────────────────────

export async function fetchInvoices(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<InvoiceListResponse> {
  const response = await api.get<InvoiceListResponse>('/api/invoices', { params, headers: authHeaders(token) });
  return response.data;
}

export async function fetchInvoice(token: string, id: string | number): Promise<Invoice> {
  const response = await api.get<{ success: boolean; data: Invoice }>(`/api/invoices/${id}`, {
    headers: authHeaders(token),
  });
  return extractSingle<Invoice>(response, 'data');
}

export async function createInvoice(token: string, data: Partial<Invoice>): Promise<Invoice> {
  const response = await api.post<Invoice>('/api/invoices', data, { headers: authHeaders(token) });
  return response.data;
}

export async function updateInvoice(token: string, id: string | number, data: Partial<Invoice>): Promise<Invoice> {
  const response = await api.put<Invoice>(`/api/invoices/${id}`, data, { headers: authHeaders(token) });
  return response.data;
}

export async function deleteInvoice(token: string, id: string | number): Promise<void> {
  await api.delete(`/api/invoices/${id}`, { headers: authHeaders(token) });
}

export async function sendInvoice(token: string, id: string | number): Promise<{ message: string; paymentUrl?: string; package?: Invoice }> {
  const response = await api.post<{ message: string; paymentUrl?: string; package?: Invoice }>(`/api/invoices/${id}/send`, {}, { headers: authHeaders(token) });
  return response.data;
}

export async function recordInvoicePayment(
  token: string,
  id: string | number,
  data: { amount: number; method?: string; reference?: string; notes?: string },
): Promise<{ success: boolean; data: Invoice; payment: Payment; creditBalance?: number }> {
  const response = await api.post<{ success: boolean; data: Invoice; payment: Payment; creditBalance?: number }>(`/api/invoices/${id}/record-payment`, data, {
    headers: authHeaders(token),
  });
  return response.data;
}

export async function downloadInvoicePdf(token: string, id: string | number): Promise<Blob> {
  const response = await api.get<Blob>(`/api/invoices/${id}/pdf`, {
    headers: authHeaders(token),
    responseType: 'blob',
  });
  return response.data;
}

export async function fetchPublicInvoice(code: string, token?: string): Promise<any> {
  const response = await api.get(`/api/invoices/pay/${code}`, { params: token ? { token } : undefined });
  return response.data;
}

export async function createInvoiceCheckout(
  code: string,
  paymentType: 'full' | 'half',
  token?: string,
): Promise<{ url: string; payment_details: any }> {
  const response = await api.post(`/api/invoices/pay/${code}/checkout`, { payment_type: paymentType }, { params: token ? { token } : undefined });
  return response.data;
}

export async function downloadPublicInvoicePdf(code: string, token?: string): Promise<Blob> {
  const response = await api.get<Blob>(`/api/invoices/pay/${code}/pdf`, {
    params: token ? { token } : undefined,
    responseType: 'blob',
  });
  return response.data;
}

export async function confirmPublicInvoicePayment(code: string, sessionId: string, token?: string): Promise<any> {
  const response = await api.get(`/api/invoices/pay/${code}/success`, { params: { session_id: sessionId, token } });
  return response.data;
}

export async function fetchPayments(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<PaymentListResponse> {
  const response = await api.get<PaymentListResponse>('/api/payments', { params, headers: authHeaders(token) });
  return response.data;
}

export async function createPayment(token: string, data: Partial<Payment>): Promise<{ message: string; payment: Payment }> {
  const response = await api.post<{ message: string; payment: Payment }>('/api/payments', data, { headers: authHeaders(token) });
  return response.data;
}

export async function deletePayment(token: string, id: string | number): Promise<{ success: boolean; message: string }> {
  const response = await api.delete<{ success: boolean; message: string }>(`/api/payments/${id}`, { headers: authHeaders(token) });
  return response.data;
}

export async function fetchExpenses(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ success: boolean; data: Expense[]; pagination: { total: number; page: number; pages: number; limit: number } }> {
  const response = await api.get<{ success: boolean; data: Expense[]; pagination: { total: number; page: number; pages: number; limit: number } }>('/api/expenses', {
    params,
    headers: authHeaders(token),
  });
  return response.data;
}

export async function fetchExpense(token: string, id: string | number): Promise<{ success: boolean; data: Expense }> {
  return (await api.get<{ success: boolean; data: Expense }>(`/api/expenses/${id}`, { headers: authHeaders(token) })).data;
}

export async function updateExpense(token: string, id: string | number, data: Partial<Expense>): Promise<{ success: boolean; data: Expense }> {
  return (await api.put<{ success: boolean; data: Expense }>(`/api/expenses/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteExpense(token: string, id: string | number): Promise<{ success: boolean; message: string }> {
  return (await api.delete<{ success: boolean; message: string }>(`/api/expenses/${id}`, { headers: authHeaders(token) })).data;
}

// ─── HR ────────────────────────────────────────────────────────────────────

export async function fetchHrDashboard(token: string): Promise<{ success: boolean; data: HrDashboardData }> {
  return (await api.get<{ success: boolean; data: HrDashboardData }>('/api/hr/dashboard', { headers: authHeaders(token) })).data;
}

export async function fetchEmployees(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ success: boolean; data: Employee[]; pagination: { total: number; page: number; pages: number; limit: number } }> {
  return (await api.get('/api/hr/employees', { params, headers: authHeaders(token) })).data;
}

export async function fetchEmployee(token: string, id: string | number): Promise<Employee> {
  const response = await api.get<{ success: boolean; data: Employee }>(`/api/hr/employees/${id}`, { headers: authHeaders(token) });
  return response.data.data;
}

export async function createEmployee(token: string, data: Partial<Employee>): Promise<Employee> {
  const response = await api.post<{ success: boolean; data: Employee }>('/api/hr/employees', data, { headers: authHeaders(token) });
  return response.data.data;
}

export async function updateEmployee(token: string, id: string | number, data: Partial<Employee>): Promise<Employee> {
  const response = await api.put<{ success: boolean; data: Employee }>(`/api/hr/employees/${id}`, data, { headers: authHeaders(token) });
  return response.data.data;
}

export async function deleteEmployee(token: string, id: string | number): Promise<{ success: boolean; message: string }> {
  return (await api.delete(`/api/hr/employees/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchTimeOff(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ success: boolean; data: TimeOffRequest[]; pagination: { total: number; page: number; pages: number; limit: number } }> {
  return (await api.get('/api/hr/time-off', { params, headers: authHeaders(token) })).data;
}

export async function fetchAnnouncements(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ success: boolean; data: Announcement[]; pagination: { total: number; page: number; pages: number; limit: number } }> {
  return (await api.get('/api/hr/announcements', { params, headers: authHeaders(token) })).data;
}

export async function fetchReminders(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ success: boolean; data: Reminder[]; pagination: { total: number; page: number; pages: number; limit: number } }> {
  return (await api.get('/api/hr/reminders', { params, headers: authHeaders(token) })).data;
}

export async function fetchPublicHolidays(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ success: boolean; data: PublicHoliday[]; count: number }> {
  return (await api.get('/api/hr/public-holidays', { params, headers: authHeaders(token) })).data;
}

export async function fetchTimeOffRequest(token: string, id: string | number): Promise<{ success: boolean; data: TimeOffRequest }> {
  return (await api.get(`/api/hr/time-off/${id}`, { headers: authHeaders(token) })).data;
}

export async function approveTimeOff(token: string, id: string | number, notes?: string): Promise<{ success: boolean; message: string; data?: TimeOffRequest }> {
  return (await api.post(`/api/hr/time-off/${id}/approve`, { notes }, { headers: authHeaders(token) })).data;
}

export async function rejectTimeOff(token: string, id: string | number, notes?: string): Promise<{ success: boolean; message: string; data?: TimeOffRequest }> {
  return (await api.post(`/api/hr/time-off/${id}/reject`, { notes }, { headers: authHeaders(token) })).data;
}

export async function fetchAnnouncement(token: string, id: string | number): Promise<Announcement> {
  return (await api.get(`/api/hr/announcements/${id}`, { headers: authHeaders(token) })).data;
}

export async function updateAnnouncement(token: string, id: string | number, data: Partial<Announcement>): Promise<Announcement> {
  return (await api.put(`/api/hr/announcements/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteAnnouncement(token: string, id: string | number): Promise<{ success: boolean; message: string }> {
  return (await api.delete(`/api/hr/announcements/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchReminder(token: string, id: string | number): Promise<Reminder> {
  return (await api.get(`/api/hr/reminders/${id}`, { headers: authHeaders(token) })).data;
}

export async function updateReminder(token: string, id: string | number, data: Partial<Reminder>): Promise<Reminder> {
  return (await api.put(`/api/hr/reminders/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteReminder(token: string, id: string | number): Promise<{ success: boolean; message: string }> {
  return (await api.delete(`/api/hr/reminders/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchPublicHoliday(token: string, id: string | number): Promise<{ success: boolean; data: PublicHoliday }> {
  return (await api.get(`/api/hr/public-holidays/${id}`, { headers: authHeaders(token) })).data;
}

export async function updatePublicHoliday(token: string, id: string | number, data: Partial<PublicHoliday>): Promise<{ success: boolean; data: PublicHoliday }> {
  return (await api.put(`/api/hr/public-holidays/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deletePublicHoliday(token: string, id: string | number): Promise<{ success: boolean; message: string }> {
  return (await api.delete(`/api/hr/public-holidays/${id}`, { headers: authHeaders(token) })).data;
}

// ─── Support ─────────────────────────────────────────────────────────────

export async function fetchTickets(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<AdminTicketListResponse> {
  return (await api.get<AdminTicketListResponse>('/api/tickets/admin', { params, headers: authHeaders(token) })).data;
}

export async function fetchTicket(token: string, id: string | number): Promise<Ticket> {
  const response = await api.get<Ticket>(`/api/tickets/admin/${id}`, { headers: authHeaders(token) });
  return response.data;
}

export async function createTicket(token: string, data: Partial<Ticket>): Promise<{ message: string; ticket: Ticket }> {
  return (await api.post('/api/tickets', data, { headers: authHeaders(token) })).data;
}

export async function updateTicket(
  token: string,
  id: string | number,
  data: Partial<Ticket>,
): Promise<{ message: string; ticket: Ticket }> {
  return (await api.put(`/api/tickets/admin/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteTicket(token: string, id: string | number): Promise<{ message: string }> {
  return (await api.delete(`/api/tickets/admin/${id}`, { headers: authHeaders(token) })).data;
}

export async function replyToTicket(token: string, id: string | number, data: Partial<TicketMessage>): Promise<TicketReplyResponse> {
  return (await api.post(`/api/tickets/admin/${id}/reply`, data, { headers: authHeaders(token) })).data;
}

export async function bulkUpdateTickets(
  token: string,
  data: { ticket_ids: number[]; action: string; value?: string | number | null },
): Promise<{ message: string; updated_count: number }> {
  return (await api.post('/api/tickets/admin/bulk-update', data, { headers: authHeaders(token) })).data;
}

export async function mergeTickets(
  token: string,
  data: { primary_ticket_id: number; secondary_ticket_ids: number[] },
): Promise<{ message: string; primary_ticket: Ticket }> {
  return (await api.post('/api/tickets/admin/merge', data, { headers: authHeaders(token) })).data;
}

export async function fetchTicketStats(token: string, period?: number): Promise<TicketStats> {
  const response = await api.get<TicketStats>('/api/tickets/admin/stats', {
    params: period ? { period } : undefined,
    headers: authHeaders(token),
  });
  return response.data;
}

export async function fetchSupportStaff(token: string): Promise<SupportStaff[]> {
  return (await api.get<SupportStaff[]>('/api/tickets/admin/staff', { headers: authHeaders(token) })).data;
}

export async function fetchCannedResponses(token: string): Promise<CannedResponse[]> {
  return (await api.get<CannedResponse[]>('/api/tickets/admin/canned-responses', { headers: authHeaders(token) })).data;
}

export async function saveCannedResponses(token: string, responses: CannedResponse[]): Promise<{ message: string }> {
  return (await api.put('/api/tickets/admin/canned-responses', { responses }, { headers: authHeaders(token) })).data;
}

export async function fetchCustomerRepositories(token: string): Promise<{ success: boolean; data: CustomerRepository[] }> {
  return (await api.get('/api/ticket-automation/customer-repositories', { headers: authHeaders(token) })).data;
}

export async function createCustomerRepository(
  token: string,
  data: Partial<CustomerRepository>,
): Promise<{ success: boolean; data: CustomerRepository }> {
  return (await api.post('/api/ticket-automation/customer-repositories', data, { headers: authHeaders(token) })).data;
}

export async function updateCustomerRepository(
  token: string,
  id: number,
  data: Partial<CustomerRepository>,
): Promise<{ success: boolean; data: CustomerRepository }> {
  return (await api.put(`/api/ticket-automation/customer-repositories/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteCustomerRepository(token: string, id: number): Promise<{ success: boolean; message: string }> {
  return (await api.delete(`/api/ticket-automation/customer-repositories/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchTicketQuotas(token: string): Promise<{ success: boolean; data: TicketQuota[]; defaults: Record<string, unknown> }> {
  return (await api.get('/api/ticket-automation/quotas', { headers: authHeaders(token) })).data;
}

export async function updateTicketQuota(
  token: string,
  profileId: number,
  data: Partial<TicketQuota>,
): Promise<{ success: boolean; data: TicketQuota }> {
  return (await api.put(`/api/ticket-automation/quotas/${profileId}`, data, { headers: authHeaders(token) })).data;
}

export async function fetchCustomersForAutomation(token: string): Promise<{ success: boolean; data: { id: number; first_name: string; last_name: string; email: string; company_id?: number | null }[] }> {
  return (await api.get('/api/ticket-automation/customers', { headers: authHeaders(token) })).data;
}

export async function fetchAutomationManualReview(token: string): Promise<{ success: boolean; data: Ticket[] }> {
  return (await api.get('/api/ticket-automation/manual-review', { headers: authHeaders(token) })).data;
}

export async function fetchMyTickets(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<CustomerTicketListResponse> {
  return (await api.get<CustomerTicketListResponse>('/api/tickets/my-tickets', { params, headers: authHeaders(token) })).data;
}

export async function fetchMyAssignedTickets(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<StaffTicketListResponse> {
  return (await api.get<StaffTicketListResponse>('/api/tickets/my-assigned', { params, headers: authHeaders(token) })).data;
}

// ─── Communication ─────────────────────────────────────────────────────────

export async function fetchChatParticipants(token: string): Promise<{ success: boolean; data: { id: number; first_name: string; last_name: string; email: string; avatar?: string | null; role?: string }[] }> {
  return (await api.get('/api/chat/participants', { headers: authHeaders(token) })).data;
}

export async function fetchWorkspaces(token: string): Promise<{ success: boolean; data: Workspace[] }> {
  return (await api.get('/api/chat/workspaces', { headers: authHeaders(token) })).data;
}

export async function createWorkspace(token: string, data: Partial<Workspace>): Promise<{ success: boolean; workspace: Workspace }> {
  return (await api.post('/api/chat/workspaces', data, { headers: authHeaders(token) })).data;
}

export async function fetchDirectMessages(token: string, params?: Record<string, string | number | boolean>): Promise<CommunicationLegacyListResponse<DirectMessage>> {
  return (await api.get('/api/chat/direct-messages', { params, headers: authHeaders(token) })).data;
}

export async function createDirectMessage(token: string, data: { participant_ids: number[]; type?: 'dm' | 'group'; name?: string }): Promise<CommunicationLegacyDataResponse<DirectMessage>> {
  return (await api.post('/api/chat/direct-messages', data, { headers: authHeaders(token) })).data;
}

export async function markDmRead(token: string, id: number, data?: { last_read_message_id?: number }): Promise<CommunicationLegacyMessageResponse> {
  return (await api.post(`/api/chat/direct-messages/${id}/read`, data || {}, { headers: authHeaders(token) })).data;
}

export async function fetchChannels(token: string, workspaceId: number): Promise<CommunicationLegacyDataResponse<Channel[]>> {
  return (await api.get('/api/chat/channels', { params: { workspace_id: workspaceId }, headers: authHeaders(token) })).data;
}

export async function createChannel(token: string, data: Partial<Channel>): Promise<CommunicationLegacyDataResponse<Channel>> {
  return (await api.post('/api/chat/channels', data, { headers: authHeaders(token) })).data;
}

export async function fetchMessagesForChannel(token: string, channelId: number, params?: Record<string, string | number | boolean>): Promise<MessageListResponse> {
  return (await api.get(`/api/messages/channel/${channelId}`, { params, headers: authHeaders(token) })).data;
}

export async function fetchMessagesForDm(token: string, dmId: number, params?: Record<string, string | number | boolean>): Promise<MessageListResponse> {
  return (await api.get(`/api/messages/direct-message/${dmId}`, { params, headers: authHeaders(token) })).data;
}

export async function sendMessage(token: string, data: Partial<Message>): Promise<MessageEnvelope<Message>> {
  return (await api.post('/api/messages', data, { headers: authHeaders(token) })).data;
}

export async function editMessage(token: string, id: number, content: string): Promise<MessageEnvelope<Message>> {
  return (await api.put(`/api/messages/${id}`, { content }, { headers: authHeaders(token) })).data;
}

export async function deleteMessage(token: string, id: number): Promise<CommunicationLegacyMessageResponse> {
  return (await api.delete(`/api/messages/${id}`, { headers: authHeaders(token) })).data;
}

export async function addReaction(token: string, messageId: number, emoji: string): Promise<CommunicationLegacyMessageResponse> {
  return (await api.post(`/api/messages/${messageId}/reactions`, { emoji }, { headers: authHeaders(token) })).data;
}

export async function fetchMailAccounts(token: string): Promise<CommunicationLegacyDataResponse<MailAccount[]>> {
  return (await api.get('/api/mail/accounts', { headers: authHeaders(token) })).data;
}

export async function createMailAccount(token: string, data: Partial<MailAccount>): Promise<CommunicationLegacyDataResponse<MailAccount>> {
  return (await api.post('/api/mail/accounts', data, { headers: authHeaders(token) })).data;
}

export async function updateMailAccount(token: string, id: string, data: Partial<MailAccount>): Promise<CommunicationLegacyDataResponse<MailAccount>> {
  return (await api.put(`/api/mail/accounts/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteMailAccount(token: string, id: string): Promise<CommunicationLegacyMessageResponse> {
  return (await api.delete(`/api/mail/accounts/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchMailFolders(token: string, accountId: string): Promise<CommunicationLegacyDataResponse<MailFolder[]>> {
  return (await api.get(`/api/mail/accounts/${accountId}/folders`, { headers: authHeaders(token) })).data;
}

export async function fetchMailMessages(token: string, accountId: string, folderPath: string, params?: Record<string, string | number | boolean>): Promise<CommunicationLegacyListResponse<CachedEmail>> {
  return (await api.get(`/api/mail/accounts/${accountId}/folders/${folderPath}/messages`, { params, headers: authHeaders(token) })).data;
}

export async function fetchMailTemplates(token: string): Promise<CommunicationLegacyDataResponse<EmailTemplate[]>> {
  return (await api.get('/api/mail/templates', { headers: authHeaders(token) })).data;
}

export async function createMailTemplate(token: string, data: Partial<EmailTemplate>): Promise<CommunicationLegacyDataResponse<EmailTemplate>> {
  return (await api.post('/api/mail/templates', data, { headers: authHeaders(token) })).data;
}

export async function updateMailTemplate(token: string, id: string, data: Partial<EmailTemplate>): Promise<CommunicationLegacyDataResponse<EmailTemplate>> {
  return (await api.put(`/api/mail/templates/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteMailTemplate(token: string, id: string): Promise<CommunicationLegacyMessageResponse> {
  return (await api.delete(`/api/mail/templates/${id}`, { headers: authHeaders(token) })).data;
}

// ─── Content / Marketing ───────────────────────────────────────────────────

export async function fetchServices(params?: Record<string, string | number | boolean>): Promise<Service[]> {
  return (await api.get('/api/services', { params })).data;
}

export async function fetchServiceBySlug(slug: string): Promise<Service> {
  return (await api.get(`/api/services/${slug}`)).data;
}

export async function fetchAdminServices(token: string, params?: Record<string, string | number | boolean>): Promise<{ items: Service[]; pagination: { total: number; limit: number | null; offset: number; hasMore: boolean } }> {
  return (await api.get('/api/services/admin/all', { params, headers: authHeaders(token) })).data;
}

export async function fetchAdminService(token: string, id: string | number): Promise<Service> {
  return (await api.get<{ item: Service }>(`/api/services/admin/${id}`, { headers: authHeaders(token) })).data.item;
}

export async function createService(token: string, data: Partial<Service>): Promise<{ message: string; item: Service }> {
  return (await api.post('/api/services/admin', data, { headers: authHeaders(token) })).data;
}

export async function updateService(token: string, id: number, data: Partial<Service>): Promise<{ message: string; item: Service }> {
  return (await api.put(`/api/services/admin/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteService(token: string, id: number): Promise<ContentLegacyMessageResponse> {
  return (await api.delete(`/api/services/admin/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchPortfolio(params?: Record<string, string | number | boolean>): Promise<{ items: PortfolioItem[]; pagination: { total: number; limit: number | null; offset: number; hasMore: boolean } }> {
  return (await api.get('/api/portfolio', { params })).data;
}

export async function fetchPortfolioBySlug(slug: string): Promise<PortfolioItem> {
  return (await api.get(`/api/portfolio/${slug}`)).data;
}

export async function fetchAdminPortfolio(token: string, params?: Record<string, string | number | boolean>): Promise<{ items: PortfolioItem[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> {
  return (await api.get('/api/portfolio/admin/all', { params, headers: authHeaders(token) })).data;
}

export async function fetchAdminPortfolioItem(token: string, id: string | number): Promise<PortfolioItem> {
  return (await api.get<{ item: PortfolioItem }>(`/api/portfolio/admin/${id}`, { headers: authHeaders(token) })).data.item;
}

export async function createPortfolioItem(token: string, data: Partial<PortfolioItem>): Promise<{ message: string; item: PortfolioItem }> {
  return (await api.post('/api/portfolio/admin', data, { headers: authHeaders(token) })).data;
}

export async function updatePortfolioItem(token: string, id: number, data: Partial<PortfolioItem>): Promise<{ message: string; item: PortfolioItem }> {
  return (await api.put(`/api/portfolio/admin/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deletePortfolioItem(token: string, id: number): Promise<ContentLegacyMessageResponse> {
  return (await api.delete(`/api/portfolio/admin/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  return (await api.get('/api/team')).data;
}

export async function fetchAdminTeamMembers(token: string): Promise<TeamMember[]> {
  return (await api.get('/api/team/admin/all', { headers: authHeaders(token) })).data;
}

export async function fetchTeamMember(token: string, id: string | number): Promise<TeamMember> {
  return (await api.get<TeamMember>(`/api/team/${id}`, { headers: authHeaders(token) })).data;
}

export async function createTeamMember(token: string, data: Partial<TeamMember>): Promise<TeamMember> {
  return (await api.post('/api/team', data, { headers: authHeaders(token) })).data;
}

export async function updateTeamMember(token: string, id: number, data: Partial<TeamMember>): Promise<TeamMember> {
  return (await api.put(`/api/team/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteTeamMember(token: string, id: number): Promise<ContentLegacyMessageResponse> {
  return (await api.delete(`/api/team/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchReviews(params?: Record<string, string | number | boolean>): Promise<Review[]> {
  return (await api.get('/api/reviews', { params })).data;
}

export async function submitReview(data: Partial<Review>): Promise<{ message: string; review: Review }> {
  return (await api.post('/api/reviews', data)).data;
}

export async function fetchAdminReviews(token: string, params?: Record<string, string | number | boolean>): Promise<{ reviews: Review[]; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number }; stats: unknown }> {
  return (await api.get('/api/admin/reviews', { params, headers: authHeaders(token) })).data;
}

export async function fetchAdminReview(token: string, id: string | number): Promise<Review> {
  return (await api.get<{ success: boolean; data: Review }>(`/api/admin/reviews/${id}`, { headers: authHeaders(token) })).data.data;
}

export async function updateReviewStatus(token: string, id: number, status: string): Promise<{ message: string; review: Review }> {
  return (await api.put(`/api/admin/reviews/${id}/status`, { status }, { headers: authHeaders(token) })).data;
}

export async function updateReview(token: string, id: number, data: Partial<Review>): Promise<{ message: string; review: Review }> {
  return (await api.put(`/api/admin/reviews/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteReview(token: string, id: number): Promise<ContentLegacyMessageResponse> {
  return (await api.delete(`/api/admin/reviews/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchBlogPosts(params?: Record<string, string | number | boolean>): Promise<{ posts: BlogPost[]; pagination: { total: number; limit: number | null; offset: number; hasMore: boolean } }> {
  return (await api.get('/api/blog', { params })).data;
}

export async function fetchBlogPost(slug: string): Promise<BlogPost> {
  return (await api.get(`/api/blog/${slug}`)).data;
}

export async function fetchBlogComments(slug: string): Promise<{ comments: Comment[]; commentsDisabled: boolean; totalCount: number }> {
  return (await api.get(`/api/blog/${slug}/comments`)).data;
}

export async function submitComment(slug: string, data: { author_name: string; author_email: string; content: string; parent_id?: number }): Promise<{ message: string; comment: Comment }> {
  return (await api.post(`/api/blog/${slug}/comments`, data)).data;
}

export async function fetchAdminBlogPosts(token: string, params?: Record<string, string | number | boolean>): Promise<{ posts: BlogPost[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> {
  return (await api.get('/api/blog/admin/all', { params, headers: authHeaders(token) })).data;
}

export async function fetchAdminBlogPost(token: string, id: string | number): Promise<BlogPost> {
  return (await api.get<{ post: BlogPost }>(`/api/blog/admin/${id}`, { headers: authHeaders(token) })).data.post;
}

export async function createBlogPost(token: string, data: Partial<BlogPost>): Promise<{ message: string; post: BlogPost }> {
  return (await api.post('/api/blog/admin', data, { headers: authHeaders(token) })).data;
}

export async function updateBlogPost(token: string, id: number, data: Partial<BlogPost>): Promise<{ message: string; post: BlogPost }> {
  return (await api.put(`/api/blog/admin/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteBlogPost(token: string, id: number): Promise<ContentLegacyMessageResponse> {
  return (await api.delete(`/api/blog/admin/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchPublicContent(key: string): Promise<unknown> {
  return (await api.get(`/api/public/${key}`)).data;
}

// ─── Settings / Admin ──────────────────────────────────────────────────────

export async function fetchPublicBillingSettings(): Promise<{ stripePublishableKey: string; enableStripe: boolean; currencyCode: string; taxRate: number; taxType: string; googleMapsApiKey: string }> {
  return (await api.get('/api/settings/public/billing-settings')).data;
}

export async function fetchAdminSettings(token: string, params?: Record<string, string | number | boolean>) {
  return (await api.get('/api/settings/admin/all', { params, headers: authHeaders(token) })).data;
}

export async function fetchAdminSetting(token: string, key: string) {
  return (await api.get(`/api/settings/admin/${key}`, { headers: authHeaders(token) })).data;
}

export async function upsertAdminSetting(token: string, key: string, data: Record<string, unknown>) {
  return (await api.put(`/api/settings/admin/${key}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteAdminSetting(token: string, key: string) {
  return (await api.delete(`/api/settings/admin/${key}`, { headers: authHeaders(token) })).data;
}

export async function fetchMarketingIntegrations(token: string) {
  return (await api.get('/api/settings/marketing-integrations', { headers: authHeaders(token) })).data;
}

export async function updateMarketingIntegrations(token: string, data: Record<string, unknown>) {
  return (await api.put('/api/settings/marketing-integrations', data, { headers: authHeaders(token) })).data;
}

export async function fetchBillingSettings(token: string) {
  return (await api.get('/api/settings/billing-settings', { headers: authHeaders(token) })).data;
}

export async function updateBillingSettings(token: string, data: Record<string, unknown>) {
  return (await api.put('/api/settings/billing-settings', data, { headers: authHeaders(token) })).data;
}

export async function fetchUsers(token: string, params?: Record<string, string | number | boolean>) {
  return (await api.get('/api/users', { params, headers: authHeaders(token) })).data;
}

export async function fetchUser(token: string, id: string | number): Promise<{ user: any; roles?: string[]; permissions?: string[] }> {
  return (await api.get(`/api/users/${id}`, { headers: authHeaders(token) })).data;
}

export async function createUser(token: string, data: Record<string, unknown>) {
  return (await api.post('/api/users', data, { headers: authHeaders(token) })).data;
}

export async function updateUser(token: string, id: number, data: Record<string, unknown>) {
  return (await api.put(`/api/users/${id}`, data, { headers: authHeaders(token) })).data;
}

export async function deleteUser(token: string, id: number) {
  return (await api.delete(`/api/users/${id}`, { headers: authHeaders(token) })).data;
}

export async function fetchUserTeam(token: string): Promise<{ id: number; first_name: string; last_name: string; email: string; role: string; avatar?: string | null }[]> {
  return (await api.get('/api/users/team', { headers: authHeaders(token) })).data;
}

export async function fetchManagers(token: string) {
  return (await api.get('/api/users/managers', { headers: authHeaders(token) })).data;
}

export async function fetchProfile(token: string) {
  return (await api.get('/api/profile', { headers: authHeaders(token) })).data;
}

export async function updateProfile(token: string, data: Record<string, unknown>) {
  return (await api.put('/api/profile', data, { headers: authHeaders(token) })).data;
}

export async function changePassword(token: string, data: { current_password: string; new_password: string; confirm_password: string }) {
  return (await api.put('/api/profile/password', data, { headers: authHeaders(token) })).data;
}

export async function fetchDashboardStats(token: string) {
  return (await api.get('/api/admin/dashboard/stats', { headers: authHeaders(token) })).data;
}

export async function fetchAuditLogs(token: string, params?: Record<string, string | number | boolean>) {
  return (await api.get('/api/admin/audit-logs', { params, headers: authHeaders(token) })).data;
}

export default api;
