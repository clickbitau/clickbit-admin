import api from './api';
import {
  CompaniesListResponse,
  DealsListResponse,
  ContactsListResponse,
  PipelinesListResponse,
  LeadsListResponse,
  ProjectsListResponse,
  ActivitiesListResponse,
  NotesListResponse,
  AutomationsListResponse,
  Company,
  Deal,
  Contact,
  Pipeline,
  Lead,
  CrmProject,
  CrmActivity,
  CrmNote,
  CrmAutomation,
} from '@clickbit/shared';

export type ApiParams = Record<string, string | number | boolean | undefined>;

function cleanParams(params?: ApiParams): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function fetchCompanies(token: string, params?: ApiParams) {
  const { data } = await api.get<CompaniesListResponse>('/api/crm/companies', {
    headers: { Authorization: `Bearer ${token}` },
    params: cleanParams(params),
  });
  return data;
}

export async function fetchCompany(token: string, id: number | string) {
  const { data } = await api.get<Company>(`/api/crm/companies/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function createCompany(token: string, payload: Partial<Company>) {
  const { data } = await api.post<Company>('/api/crm/companies', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateCompany(token: string, id: number | string, payload: Partial<Company>) {
  const { data } = await api.put<Company>(`/api/crm/companies/${id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function deleteCompany(token: string, id: number | string) {
  const { data } = await api.delete(`/api/crm/companies/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function fetchContacts(token: string, params?: ApiParams) {
  const { data } = await api.get<ContactsListResponse>('/api/crm/contacts', {
    headers: { Authorization: `Bearer ${token}` },
    params: cleanParams(params),
  });
  return data;
}

export async function fetchContact(token: string, id: number | string) {
  const { data } = await api.get<{ data: Contact }>(`/api/crm/contacts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data;
}

export async function createContact(token: string, payload: Partial<Contact>) {
  const { data } = await api.post<Contact>('/api/crm/contacts', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateContact(token: string, id: number | string, payload: Partial<Contact>) {
  const { data } = await api.put<Contact>(`/api/crm/contacts/${id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function convertContactToDeal(token: string, id: number | string, payload?: unknown) {
  const { data } = await api.post<Deal>(`/api/crm/contacts/${id}/convert-to-deal`, payload ?? {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function fetchDeals(token: string, params?: ApiParams) {
  const { data } = await api.get<DealsListResponse>('/api/crm/deals', {
    headers: { Authorization: `Bearer ${token}` },
    params: cleanParams(params),
  });
  return data;
}

export async function fetchDeal(token: string, id: number | string) {
  const { data } = await api.get<Deal>(`/api/crm/deals/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function createDeal(token: string, payload: Partial<Deal>) {
  const { data } = await api.post<Deal>('/api/crm/deals', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateDeal(token: string, id: number | string, payload: Partial<Deal>) {
  const { data } = await api.put<Deal>(`/api/crm/deals/${id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function moveDeal(token: string, id: number | string, stageId: number) {
  const { data } = await api.put<Deal>(`/api/crm/deals/${id}/move`, { stage_id: stageId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function winDeal(token: string, id: number | string, payload?: { won_reason?: string }) {
  const { data } = await api.put<Deal>(`/api/crm/deals/${id}/won`, payload ?? {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function fetchPipelines(token: string, params?: ApiParams) {
  const { data } = await api.get<PipelinesListResponse>('/api/crm/pipelines', {
    headers: { Authorization: `Bearer ${token}` },
    params: cleanParams(params),
  });
  return data;
}

export async function fetchPipeline(token: string, id: number | string) {
  const { data } = await api.get<Pipeline>(`/api/crm/pipelines/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function fetchLeads(token: string, params?: ApiParams) {
  const { data } = await api.get<LeadsListResponse>('/api/crm/leads', {
    headers: { Authorization: `Bearer ${token}` },
    params: cleanParams(params),
  });
  return data;
}

export async function fetchLead(token: string, id: number | string) {
  const { data } = await api.get<Lead>(`/api/crm/leads/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function createLead(token: string, payload: Partial<Lead>) {
  const { data } = await api.post<Lead>('/api/crm/leads', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateLead(token: string, id: number | string, payload: Partial<Lead>) {
  const { data } = await api.put<Lead>(`/api/crm/leads/${id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function moveLead(token: string, id: number | string, stageId: number) {
  const { data } = await api.patch<Lead>(`/api/crm/leads/${id}/move`, { stage_id: stageId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function fetchProjects(token: string, params?: ApiParams) {
  const { data } = await api.get<ProjectsListResponse>('/api/crm/projects-new', {
    headers: { Authorization: `Bearer ${token}` },
    params: cleanParams(params),
  });
  return data;
}

export async function fetchProject(token: string, id: number | string) {
  const { data } = await api.get<CrmProject>(`/api/crm/projects-new/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function createProject(token: string, payload: Partial<CrmProject>) {
  const { data } = await api.post<CrmProject>('/api/crm/projects-new', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateProject(token: string, id: number | string, payload: Partial<CrmProject>) {
  const { data } = await api.put<CrmProject>(`/api/crm/projects-new/${id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function fetchProjectTasks(token: string, id: number | string) {
  const { data } = await api.get<{ tasks: unknown[]; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } }>(
    `/api/crm/projects-new/${id}/tasks`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

export async function fetchActivities(token: string, params?: ApiParams) {
  const { data } = await api.get<ActivitiesListResponse>('/api/crm/activities', {
    headers: { Authorization: `Bearer ${token}` },
    params: cleanParams(params),
  });
  return data;
}

export async function createActivity(token: string, payload: Partial<CrmActivity>) {
  const { data } = await api.post<CrmActivity>('/api/crm/activities', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateActivity(token: string, id: number | string, payload: Partial<CrmActivity>) {
  const { data } = await api.put<CrmActivity>(`/api/crm/activities/${id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function fetchNotes(token: string, params?: ApiParams) {
  const { data } = await api.get<NotesListResponse>('/api/crm/notes', {
    headers: { Authorization: `Bearer ${token}` },
    params: cleanParams(params),
  });
  return data;
}

export async function createNote(token: string, payload: Partial<CrmNote>) {
  const { data } = await api.post<CrmNote>('/api/crm/notes', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function fetchAutomations(token: string, params?: ApiParams) {
  const { data } = await api.get<AutomationsListResponse>('/api/crm/automations', {
    headers: { Authorization: `Bearer ${token}` },
    params: cleanParams(params),
  });
  return data;
}
