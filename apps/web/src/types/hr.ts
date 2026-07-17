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
  break_minutes?: number;
  total_minutes?: number | null;
  status: 'active' | 'completed' | 'approved' | 'rejected' | 'edited';
  employee?: { name?: string; email?: string };
  shift?: any;
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
