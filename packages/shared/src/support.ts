export interface TicketProfile {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  avatar?: string | null;
  role?: string;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id?: number | null;
  message: string;
  message_type: string;
  is_staff_reply?: boolean;
  is_internal?: boolean;
  sender_name?: string | null;
  sender_email?: string | null;
  attachments?: unknown[];
  read_at?: string | null;
  created_at: string;
  updated_at: string;
  sender?: TicketProfile | null;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  user_id?: number | null;
  assigned_to?: number | null;
  guest_name?: string | null;
  guest_email?: string | null;
  contact_email?: string | null;
  related_order_id?: number | null;
  tags?: string[];
  attachments?: unknown[];
  internal_notes?: string | null;
  satisfaction_rating?: number | null;
  satisfaction_feedback?: string | null;
  first_response_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  last_activity_at?: string | null;
  source?: string | null;
  auto_fix_status?: string | null;
  bug_report_id?: number | null;
  created_at: string;
  updated_at: string;
  user?: TicketProfile | null;
  assignee?: TicketProfile | null;
  messages?: TicketMessage[];
}

export interface TicketListResponse {
  tickets: Ticket[];
  pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number };
}

export interface AdminTicketListResponse extends TicketListResponse {}

export interface CustomerTicketListResponse extends TicketListResponse {}

export interface StaffTicketListResponse {
  tickets: Ticket[];
}

export interface TicketReplyResponse {
  message: string;
  reply: TicketMessage;
  ticket?: Ticket;
}

export interface TicketStatsOverview {
  total: number;
  open: number;
  unassigned: number;
  overdue: number;
  newThisPeriod: number;
  resolvedThisPeriod: number;
}

export interface TicketStats {
  overview: TicketStatsOverview;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  byAssignee: { id: number; count: number }[];
  performance: {
    avgFirstResponseHours: number | null;
    avgResolutionHours: number | null;
    avgSatisfactionRating: number | null;
    totalRatings: number;
  };
  period: number;
}

export interface SupportStaff extends TicketProfile {
  open_tickets_count: number;
}

export interface CannedResponse {
  id?: number;
  title: string;
  content: string;
  category?: string;
}

export interface CustomerRepository {
  id: number;
  profile_id?: number | null;
  company_id?: number | null;
  repo_full_name: string;
  auto_fix_enabled: boolean;
  require_approval: boolean;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  customer?: TicketProfile | null;
  company?: { id: number; name: string } | null;
}

export interface TicketQuota {
  id?: number;
  profile_id: number;
  free_limit: number;
  period: string;
  price_cents: number;
  currency: string;
  updated_by?: number | null;
  created_at?: string;
  updated_at?: string;
  customer?: TicketProfile;
}

export interface TicketPurchase {
  id: number;
  profile_id?: number | null;
  ticket_id?: number | null;
  contact_email?: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  stripe_session_id?: string | null;
  created_at: string;
  customer?: TicketProfile | null;
}

export interface SupportLegacyPagination {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface SupportLegacyListResponse<T> {
  success: boolean;
  data: T[];
  pagination: SupportLegacyPagination;
}

export interface SupportLegacyDataResponse<T> {
  success: boolean;
  data: T;
}

export interface SupportLegacyMessageResponse {
  success: boolean;
  message: string;
}
