import { Pagination, AggregatedStats, CompanyOwner, Contact } from './index';

export interface PipelineStage {
  id: number;
  pipeline_id: number;
  name: string;
  description?: string | null;
  position: number;
  probability?: number | null;
  color?: string | null;
  is_won?: boolean | null;
  is_lost?: boolean | null;
  rotting_days?: number | null;
  is_active?: boolean | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  is_demo?: boolean;
  deal_count?: number;
  total_value?: number;
}

export interface Pipeline {
  id: number;
  name: string;
  description?: string | null;
  pipeline_type?: string;
  currency?: string | null;
  is_default?: boolean | null;
  is_active?: boolean | null;
  created_by?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  is_demo?: boolean;
  stages?: PipelineStage[];
}

export interface DealContact {
  id: number;
  deal_id: number;
  contact_id: number;
  role?: string | null;
  is_primary?: boolean | null;
  contact?: Contact;
}

export interface Deal {
  id: number;
  deal_number: string;
  title: string;
  description?: string | null;
  value?: number | string | null;
  currency?: string | null;
  pipeline_id: number;
  stage_id: number;
  contact_id?: number | null;
  company_id?: number | null;
  owner_id?: number | null;
  probability?: number | null;
  expected_close_date?: Date | string | null;
  actual_close_date?: Date | string | null;
  won_reason?: string | null;
  lost_reason?: string | null;
  competitor?: string | null;
  lead_source?: string | null;
  priority?: string;
  status?: string;
  stage_entered_at?: Date | string | null;
  last_activity_at?: Date | string | null;
  next_activity_date?: Date | string | null;
  order_id?: number | null;
  custom_package_id?: number | null;
  tags?: unknown[] | null;
  custom_fields?: Record<string, unknown> | null;
  position?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  is_project?: boolean;
  project_status?: string | null;
  project_start_date?: Date | string | null;
  project_end_date?: Date | string | null;
  project_completion_percentage?: number;
  deleted_at?: Date | string | null;
  pipeline?: Pipeline;
  stage?: PipelineStage;
  owner?: CompanyOwner | null;
  primaryContact?: Contact | null;
  company?: { id: number; name: string } | null;
  contactAssociations?: DealContact[];
  activities?: CrmActivity[];
  notes?: CrmNote[];
}

export interface Lead {
  id: number;
  contact_id?: number | null;
  converted_contact_id?: number | null;
  company_id?: number | null;
  pipeline_id?: number | null;
  stage_id?: number | null;
  owner_id?: number | null;
  title?: string | null;
  status?: string;
  score?: number | null;
  temperature?: string | null;
  source?: string | null;
  source_detail?: string | null;
  value?: number | string | null;
  currency?: string | null;
  expected_close_date?: Date | string | null;
  last_contact_at?: Date | string | null;
  next_contact_at?: Date | string | null;
  notes?: string | null;
  assigned_to?: number | null;
  is_converted?: boolean;
  converted_at?: Date | string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  deleted_at?: Date | string | null;
  contact?: Contact;
  company?: { id: number; name: string };
  owner?: CompanyOwner | null;
  pipeline?: Pipeline;
  stage?: PipelineStage;
}

export interface CrmProjectDocument {
  id: number;
  project_id?: number | null;
  file_name: string;
  file_url: string;
  storage_key?: string | null;
  file_size: number;
  file_type: string;
  uploaded_by?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  uploader?: CompanyOwner | null;
}

export interface CrmSubproject {
  id: number;
  parent_project_id: number;
  name: string;
  description?: string | null;
  status?: string | null;
  progress_percentage?: number | null;
  priority?: string | null;
  budget?: number | string | null;
  actual_cost?: number | string | null;
  currency?: string | null;
  start_date?: Date | string | null;
  due_date?: Date | string | null;
  completed_date?: Date | string | null;
  manager_id?: number | null;
  created_by?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  deleted_at?: Date | string | null;
  manager?: CompanyOwner | null;
  documents?: CrmProjectDocument[];
}

export interface CrmProject {
  id: number;
  project_number?: string | null;
  name: string;
  description?: string | null;
  status?: string | null;
  progress_percentage?: number | null;
  priority?: string | null;
  budget?: number | string | null;
  actual_cost?: number | string | null;
  currency?: string | null;
  start_date?: Date | string | null;
  due_date?: Date | string | null;
  completed_date?: Date | string | null;
  estimated_hours?: number | string | null;
  actual_hours?: number | string | null;
  customer_id?: number | null;
  company_id?: number | null;
  deal_id?: number | null;
  manager_id?: number | null;
  created_by?: number | null;
  project_type?: string | null;
  customer_visible?: boolean | null;
  tags?: unknown[] | null;
  custom_fields?: Record<string, unknown> | null;
  internal_notes?: string | null;
  customer_notes?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  deleted_at?: Date | string | null;
  hourly_rate?: number | string | null;
  support_period_type?: string | null;
  support_start_date?: Date | string | null;
  support_end_date?: Date | string | null;
  support_price?: number | string | null;
  support_currency?: string | null;
  support_notes?: string | null;
  is_demo?: boolean;
  company?: { id: number; name: string } | null;
  customer?: Contact | null;
  deal?: Deal | null;
  manager?: CompanyOwner | null;
  owner?: CompanyOwner | null;
  documents?: CrmProjectDocument[];
  subprojects?: CrmSubproject[];
  meetings?: CrmMeeting[];
  tasks?: ProjectTask[];
}

export interface ProjectTask {
  id: number;
  project_id?: number | null;
  crm_project_id?: number | null;
  subproject_id?: number | null;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigned_to?: number | null;
  estimated_hours?: number | string | null;
  actual_hours?: number | string | null;
  due_date?: Date | string | null;
  start_date?: Date | string | null;
  completed_at?: Date | string | null;
  parent_task_id?: number | null;
  position?: number | null;
  tags?: unknown[] | null;
  attachments?: unknown[] | null;
  created_by?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  deleted_at?: Date | string | null;
  customer_id?: number | null;
  customer_visible?: boolean;
  phase_id?: number | null;
  weight?: number | string | null;
  expected_duration_days?: number | string | null;
  is_template_generated?: boolean;
  is_demo?: boolean;
  assignee?: CompanyOwner | null;
  subtasks?: ProjectTask[];
}

export interface CrmActivity {
  id: number;
  activity_type: string;
  subject: string;
  description?: string | null;
  status?: string;
  priority?: string;
  due_date?: Date | string | null;
  due_time?: Date | string | null;
  duration_minutes?: number | null;
  completed_at?: Date | string | null;
  outcome?: string | null;
  contact_id?: number | null;
  company_id?: number | null;
  deal_id?: number | null;
  owner_id?: number | null;
  assigned_to?: number | null;
  created_by?: number | null;
  location?: string | null;
  meeting_link?: string | null;
  attendees?: unknown[] | null;
  email_subject?: string | null;
  email_body?: string | null;
  email_sent_at?: Date | string | null;
  reminder_at?: Date | string | null;
  is_recurring?: boolean | null;
  is_pinned?: boolean | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  contact?: Contact | null;
  company?: { id: number; name: string } | null;
  deal?: Deal | null;
  owner?: CompanyOwner | null;
  assigned?: CompanyOwner | null;
}

export interface CrmNote {
  id: number;
  content: string;
  note_type?: string | null;
  contact_id?: number | null;
  company_id?: number | null;
  deal_id?: number | null;
  activity_id?: number | null;
  created_by?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  contact?: Contact | null;
  company?: { id: number; name: string } | null;
  deal?: Deal | null;
  author?: CompanyOwner | null;
}

export interface CrmMeeting {
  id: number;
  project_id?: number | null;
  title: string;
  description?: string | null;
  meeting_date?: Date | string | null;
  start_time?: Date | string | null;
  end_time?: Date | string | null;
  duration_minutes?: number | null;
  meeting_link?: string | null;
  location?: string | null;
  attendees?: unknown[] | null;
  status?: string | null;
  created_by?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  creator?: CompanyOwner | null;
}

export interface CrmAutomation {
  id: number;
  name: string;
  description?: string | null;
  trigger_type: string;
  trigger_conditions?: Record<string, unknown> | null;
  action_type: string;
  action_config?: Record<string, unknown> | null;
  target_entity?: string;
  delay_minutes?: number | null;
  is_active?: boolean | null;
  execution_count?: number | null;
  last_executed_at?: Date | string | null;
  created_by?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  creator?: CompanyOwner | null;
}

export interface PipelinesListResponse {
  pipelines: Pipeline[];
  pagination: Pagination;
}

export interface DealsListResponse {
  deals: Deal[];
  pagination: Pagination;
}

export interface LeadsListResponse {
  leads: Lead[];
  pagination: Pagination;
}

export interface ProjectsListResponse {
  projects: CrmProject[];
  pagination: Pagination;
}

export interface ActivitiesListResponse {
  activities: CrmActivity[];
  pagination: Pagination;
}

export interface NotesListResponse {
  notes: CrmNote[];
  pagination: Pagination;
}

export interface AutomationsListResponse {
  automations: CrmAutomation[];
  pagination: Pagination;
}

export interface ContactsListResponse {
  contacts: (Contact & { primary_company?: { id: number; name: string } | null })[];
  pagination: { total: number; limit: number; offset: number } | Pagination;
}
