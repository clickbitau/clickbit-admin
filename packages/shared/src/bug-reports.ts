export type BugReportCategory =
  | 'invoice'
  | 'dashboard'
  | 'login'
  | 'crm'
  | 'hr'
  | 'payments'
  | 'other'
  | 'mobile'
  | 'deploy';

export type BugReportStatus =
  | 'pending'
  | 'investigating'
  | 'fixing'
  | 'blocked'
  | 'merged'
  | 'deployed'
  | 'failed'
  | 'cancelled';

export type BugReportPriority = 'low' | 'medium' | 'high' | 'critical';

export interface BugReport {
  id: number;
  title: string;
  description: string;
  screenshot_url?: string | null;
  category?: BugReportCategory | null;
  status?: BugReportStatus | null;
  priority?: BugReportPriority | null;
  reported_by?: number | null;
  reporter?: { id: number; first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  jules_session_id?: string | null;
  jules_source?: string | null;
  pull_request_url?: string | null;
  pull_request_number?: number | null;
  error_message?: string | null;
  fix_summary?: string | null;
  require_approval?: boolean | null;
  approved_by?: number | null;
  approver?: { id: number; first_name?: string | null; last_name?: string | null } | null;
  approved_at?: string | null;
  merged_at?: string | null;
  deployed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  target_repo?: string | null;
  devin_session_id?: string | null;
  devin_session_url?: string | null;
  ticket_id?: number | null;
  pipelineStatus?: string | null;
}

export interface BugReportStats {
  total: number;
  active: number;
  pending: number;
  investigating: number;
  fixing: number;
  blocked: number;
  merged: number;
  deployed: number;
  failed: number;
  cancelled: number;
}

export interface BugReportListResponse {
  success: boolean;
  data: BugReport[];
  total: number;
  limit: number;
  offset: number;
}

export interface BugReportConfig {
  devin: { configured: boolean; status: any };
  github: { configured: boolean; status: any };
}

export interface CreateBugReportInput {
  title: string;
  description: string;
  category?: BugReportCategory;
  priority?: BugReportPriority;
  screenshot_url?: string;
  error_message?: string;
  target_repo?: string;
  require_approval?: boolean;
  ticket_id?: number;
}
