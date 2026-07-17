export type {
  Employee,
  TimeOffRequest,
  Announcement,
  Reminder,
  PublicHoliday,
  EmployeeDocument,
  LegacyPagination,
  LegacyListResponse,
  LegacyDataResponse,
  LegacyMessageResponse,
  HrDashboardData,
} from '@clickbit/shared';

export interface TimeClockStatus {
  clockedIn: boolean;
  isOnBreak: boolean;
  activeEntry?: TimeEntry | null;
  todaySummary?: { totalMinutes: number; breakMinutes: number; entriesCount: number };
}

export interface TimeEntry {
  id: number;
  employee_id: number;
  clock_in_time: string;
  clock_out_time?: string | null;
  clock_in_address?: string | null;
  clock_out_address?: string | null;
  clock_in_notes?: string | null;
  clock_out_notes?: string | null;
  notes?: string | null;
  break_minutes?: number;
  total_minutes?: number | null;
  overtime_minutes?: number | null;
  status: 'active' | 'completed' | 'approved' | 'rejected' | 'edited';
  gps_coordinates?: string | null;
  approved_by?: number | null;
  approved_at?: string | null;
  approved_by_name?: string | null;
  admin_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  employee?: { name?: string; email?: string; hourly_rate?: number | string | null };
  shift?: any;
  work_items?: any[];
  work_items_count?: number;
}

export interface TimesheetSummary {
  totalMinutes: number;
  totalBreakMinutes: number;
  totalOvertimeMinutes: number;
  entriesCount: number;
  daysSummary: Record<string, { minutes: number; entries: number }>;
  totalHours: number;
  totalOvertimeHours: number;
}

export interface Shift {
  id: number;
  employee_id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  start_datetime?: string | null;
  end_datetime?: string | null;
  scheduled_break_minutes?: number;
  shift_type?: string;
  department?: string | null;
  position?: string | null;
  location?: string | null;
  status: string;
  employee_confirmed?: boolean;
  is_open_shift?: boolean;
  open_shift_limit?: number | null;
  color?: string;
  notes?: string | null;
  employee?: { name?: string; email?: string };
}

export interface Payslip {
  id: number;
  employee_id: number;
  pay_period_start: string;
  pay_period_end: string;
  payment_date: string;
  pay_frequency: string;
  currency: string;
  gross_pay: number | string;
  tax_withheld: number | string;
  superannuation: number | string;
  net_pay: number | string;
  ytd_gross: number | string;
  ytd_tax: number | string;
  ytd_super: number | string;
  status?: string;
  pdf_url?: string | null;
  line_items?: unknown[];
  leave_data?: Record<string, unknown>;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  employee?: { name?: string; email?: string };
}

export interface PayslipCalcResult extends Payslip {
  employee_name?: string;
  timesheet_hours?: number;
  is_overdue?: boolean;
}

export interface Contract {
  id: number;
  employee_id: number;
  contract_number?: string | null;
  employment_type?: string;
  position?: string | null;
  department?: string | null;
  manager_id?: number | null;
  hourly_rate?: number | string | null;
  salary?: number | string | null;
  pay_frequency?: string;
  currency?: string | null;
  default_weekly_hours?: number | string | null;
  work_schedule?: Record<string, unknown>;
  start_date: string;
  end_date?: string | null;
  status?: string;
  renewal_date?: string | null;
  terms_summary?: string | null;
  change_reason?: string | null;
  notes?: string | null;
  responsibilities?: string | null;
  work_address?: string | null;
  work_city?: string | null;
  work_state?: string | null;
  work_country?: string | null;
  work_postcode?: string | null;
  work_timezone?: string | null;
  employee?: { name?: string; email?: string };
  manager?: { name?: string; email?: string };
  creator?: { name?: string; email?: string };
}

export interface KpiScore {
  employee_id: number;
  period: string;
  total_score: number;
  punctuality_score: number;
  task_efficiency_score: number;
  task_timeliness_score: number;
  support_resolution_score: number;
  leadership_score: number;
  documentation_score: number;
  metadata?: Record<string, unknown>;
  employee?: { name?: string; email?: string };
}
