export interface Employee {
  id: number;
  user_id: number;
  employee_number?: string | null;
  employment_type?: string | null;
  employment_status?: string | null;
  department?: string | null;
  position?: string | null;
  manager_id?: number | null;
  hire_date?: string | null;
  termination_date?: string | null;
  default_weekly_hours?: number | null;
  work_schedule?: unknown;
  hourly_rate?: number | null;
  salary?: number | null;
  pay_frequency?: string | null;
  annual_leave_balance?: number | null;
  sick_leave_balance?: number | null;
  personal_leave_balance?: number | null;
  can_clock_in?: boolean | null;
  require_gps_clock_in?: boolean | null;
  require_photo_clock_in?: boolean | null;
  allowed_clock_in_locations?: unknown;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  date_of_birth?: string | null;
  tax_file_number?: string | null;
  super_fund_name?: string | null;
  super_member_number?: string | null;
  bank_account_name?: string | null;
  bank_bsb?: string | null;
  bank_account_number?: string | null;
  skills?: unknown;
  certifications?: unknown;
  notes?: string | null;
  custom_fields?: unknown;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  department_id?: number | null;
  abn?: string | null;
  tax_free_threshold_claimed?: boolean | null;
  currency?: string | null;
  super_usi?: string | null;
  location?: string | null;
  auto_clock_in?: boolean | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postcode?: string | null;
  timezone?: string | null;
  is_demo?: boolean;
  user?: { id: number; first_name?: string; last_name?: string; email?: string; avatar?: string | null; phone?: string | null; address?: string | null; role?: string | null } | null;
  manager?: { id: number; first_name?: string; last_name?: string; email?: string } | null;
  departmentInfo?: { id: number; name?: string } | null;
  documents?: Record<string, unknown>[];
  contracts?: Record<string, unknown>[];
  timeEntries?: Record<string, unknown>[];
  timeOffRequests?: Record<string, unknown>[];
  payslips?: Record<string, unknown>[];
  shifts?: Record<string, unknown>[];
  isWorking?: boolean;
  todayHours?: number;
  weeklyHours?: number;
  activeEntry?: Record<string, unknown> | null;
}

export interface TimeOffRequest {
  id: number;
  employee_id: number;
  request_number?: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  is_partial_day?: boolean | null;
  partial_day_type?: string | null;
  partial_start_time?: string | null;
  partial_end_time?: string | null;
  total_days?: number | null;
  total_hours?: number | null;
  status?: string | null;
  reason?: string | null;
  notes?: string | null;
  attachments?: unknown;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  balance_at_request?: number | null;
  deducted_from_balance?: boolean | null;
  substitute_employee_id?: number | null;
  substitute_approved?: boolean | null;
  emergency_contact?: unknown;
  submitted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  is_demo?: boolean;
  employee?: { id: number; user?: { first_name?: string; last_name?: string; email?: string } } | null;
  substitute?: { id: number; user?: { first_name?: string; last_name?: string; email?: string }; documents?: unknown } | null;
  reviewer?: { id: number; first_name?: string; last_name?: string; email?: string } | null;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  content_html?: string | null;
  type?: string | null;
  priority?: string | null;
  target_type?: string | null;
  target_departments?: unknown;
  target_positions?: unknown;
  target_employee_ids?: unknown;
  status?: string | null;
  publish_at?: string | null;
  expires_at?: string | null;
  author_id: number;
  attachments?: unknown;
  featured_image?: string | null;
  require_acknowledgment?: boolean | null;
  acknowledgment_deadline?: string | null;
  acknowledged_by?: unknown;
  allow_comments?: boolean | null;
  allow_reactions?: boolean | null;
  view_count?: number | null;
  views?: unknown;
  reactions?: unknown;
  comments?: unknown;
  is_pinned?: boolean | null;
  pin_order?: number | null;
  send_push_notification?: boolean | null;
  push_sent_at?: string | null;
  send_email?: boolean | null;
  email_sent_at?: string | null;
  created_at?: string;
  updated_at?: string;
  visible_to_customers?: boolean;
  visible_to_agents?: boolean;
  visible_to_guests?: boolean;
  author?: { id: number; first_name?: string; last_name?: string; email?: string } | null;
}

export interface Reminder {
  id: number;
  title: string;
  description?: string | null;
  trigger_type?: string | null;
  reminder_date: string;
  status?: string | null;
  send_email?: boolean | null;
  email_sent?: boolean | null;
  email_sent_at?: string | null;
  reference_type?: string | null;
  reference_id?: number | null;
  created_by: number;
  assigned_to?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  creator?: { id: number; first_name?: string; last_name?: string; email?: string } | null;
  assignee?: { id: number; first_name?: string; last_name?: string; email?: string } | null;
}

export interface PublicHoliday {
  id: number;
  name: string;
  holiday_date: string;
  location?: string | null;
  is_recurring?: boolean | null;
  notes?: string | null;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeDocument {
  id: number;
  employee_id: number;
  name: string;
  description?: string | null;
  file_url: string;
  file_name: string;
  file_size?: number | null;
  file_type?: string | null;
  category?: string | null;
  uploaded_by?: number | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyPagination {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface LegacyListResponse<T> {
  success: boolean;
  data: T[];
  pagination: LegacyPagination;
}

export interface LegacyDataResponse<T> {
  success: boolean;
  data: T;
}

export interface LegacyMessageResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface HrDashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  clockedInCount: number;
  pendingTimeOff: number;
  todayShifts: number;
  overdueTimeEntries: number;
  onLeaveToday: number;
}

export interface HrDashboardData {
  stats: HrDashboardStats;
  departmentStats: Array<{ department?: string | null; count: number }>;
  recentAnnouncements: Announcement[];
  clockedInEmployees: Array<{
    id?: number;
    name?: string;
    email?: string;
    avatar_url?: string | null;
    clockInTime?: string | Date;
    department?: string;
  }>;
}

export interface HrStats {
  employees: {
    total: number;
    active: number;
    onLeave: number;
    terminated: number;
    byDepartment: Array<{ department: string; count: number }>;
  };
  contracts: { total: number; active: number; expired: number; expiringSoon: number };
  timeOff: { total: number; pending: number; approved: number; rejected: number };
  timesheets: { total: number; active: number; completed: number; approved: number; rejected: number };
  shifts: { total: number; today: number; upcoming: number; completed: number; cancelled: number };
  payslips: { total: number; draft: number; generated: number; paid: number; sent: number };
  timeClock: { active: number; completedToday: number };
  announcements: { total: number; published: number; scheduled: number; draft: number };
  reminders: { total: number; pending: number; complete: number };
  publicHolidays: { total: number; upcoming: number };
}
