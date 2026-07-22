export interface StaffAdvanceEmployee {
  id: number;
  employee_number: string;
  job_title?: string | null;
  employment_type?: string | null;
  profiles?: {
    id: number;
    first_name: string;
    last_name: string;
    email?: string | null;
    avatar?: string | null;
  } | null;
}

export interface StaffAdvanceDeduction {
  id: number;
  advance_id: number;
  amount: number;
  deduction_date: string;
  deduction_type: 'pay_deduction' | 'cash_repayment' | 'manual_adjustment';
  notes?: string | null;
  creator?: { first_name?: string | null; last_name?: string | null } | null;
  created_at?: string;
}

export interface StaffAdvance {
  id: number;
  employee_id: number;
  title: string;
  description?: string | null;
  total_amount: number;
  remaining_balance: number;
  advance_type: 'asset' | 'cash' | 'loan';
  status: 'pending' | 'active' | 'cleared' | 'written_off' | 'rejected';
  advance_date: string;
  notes?: string | null;
  pay_period_start?: string | null;
  pay_period_end?: string | null;
  is_pay_advance?: boolean | null;
  notes_employee?: string | null;
  created_at?: string;
  updated_at?: string;
  employee: StaffAdvanceEmployee;
  creator?: { first_name?: string | null; last_name?: string | null } | null;
  deductions?: StaffAdvanceDeduction[];
}

export interface StaffAdvanceStats {
  totalOutstanding: number;
  totalIssued: number;
  totalRecovered: number;
  activeCount: number;
  pendingCount: number;
}

export interface StaffAdvanceListResponse {
  success: boolean;
  data: StaffAdvance[];
  stats: StaffAdvanceStats;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

export interface CreateStaffAdvanceInput {
  employee_id: number;
  title: string;
  description?: string;
  total_amount: number;
  advance_type?: 'asset' | 'cash' | 'loan';
  advance_date?: string;
  notes?: string;
  is_pay_advance?: boolean;
  pay_period_start?: string;
  pay_period_end?: string;
  notes_employee?: string;
}
