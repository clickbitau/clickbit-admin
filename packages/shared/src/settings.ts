export interface SiteSetting {
  id: number;
  setting_key: string;
  setting_value?: string | null;
  setting_type: string;
  description?: string | null;
  is_public: boolean;
  auto_load: boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface PublicBillingSettings {
  stripePublishableKey: string;
  enableStripe: boolean;
  currencyCode: string;
  taxRate: number;
  taxType: string;
  googleMapsApiKey: string;
}

export interface BillingSettings {
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  currencyCode?: string;
  taxRate?: number;
  companyAbn?: string;
  billingAddress?: string;
  paymentTerms?: string;
}

export interface MarketingIntegrations {
  headerScripts?: string;
  googleSearchConsoleTag?: string;
  googleAnalyticsId?: string;
  facebookPixelId?: string;
  customMetaTags?: string;
}

export interface UserListResponse<T = unknown> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AuditLogEntry {
  id: string;
  event_time?: Date | string;
  created_at?: Date | string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id?: number | null;
  actor_type?: string | null;
  changes?: unknown;
  previous_state?: unknown;
  ip_address?: string | null;
  metadata?: unknown;
}

export interface DashboardStats {
  totalUsers: number;
  totalBlogPosts: number;
  publishedPosts: number;
  totalPortfolioItems: number;
  pendingComments: number;
  totalContacts: number;
  totalServices: number;
  totalOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalDue: number;
  newContactsThisWeek: number;
  newContactsThisMonth: number;
  userGrowth: number;
  contactGrowth: number;
  topBlogPosts: { id: number; title: string; slug: string; view_count?: number }[];
  recentContacts: unknown[];
  myTaskStats: { total: number; todo: number; inProgress: number; overdue: number };
}
