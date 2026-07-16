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

const api = axios.create({
  baseURL: '/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function authHeaders(token: string) {
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

export default api;
