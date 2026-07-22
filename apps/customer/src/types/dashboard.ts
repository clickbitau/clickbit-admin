export interface MyTaskStats {
  total: number;
  todo: number;
  inProgress: number;
  overdue: number;
}

export interface DashboardStats {
  totalContacts: number;
  totalLeads: number;
  newContactsThisWeek: number;
  newContactsThisMonth: number;
  contactGrowth: number;
  totalUsers: number;
  newUsersThisMonth: number;
  userGrowth: number;
  totalCompanies: number;
  totalDeals: number;
  totalProjects: number;
  totalTickets: number;
  totalInvoices: number;
  totalOrders: number;
  totalServices: number;
  totalPortfolioItems: number;
  totalBlogPosts: number;
  publishedPosts: number;
  pendingComments: number;
  totalAnalyticsEvents: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalDue: number;
  recentContacts: Array<{
    id: number;
    name: string;
    email?: string | null;
    contact_type: string;
    created_at: string | Date;
  }>;
  topBlogPosts: Array<{
    id: number;
    title: string;
    slug?: string | null;
    view_count: number;
    created_at: string | Date;
  }>;
  myTaskStats: MyTaskStats;
}

export interface FinanceOverview {
  totalRevenue: number;
  periodRevenue: number;
  totalExpenses: number;
  periodExpenses: number;
  totalProfit: number;
  periodProfit: number;
  profitMargin: string;
  outstandingAmount: number;
  previousPeriodRevenue?: number;
  previousPeriodExpenses?: number;
  previousPeriodProfit?: number;
}

export interface FinanceTrendPoint {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface FinanceDashboardData {
  overview: FinanceOverview;
  trends: { monthly: FinanceTrendPoint[] };
  breakdown: { expensesByCategory: Array<{ category: string; amount: number }> };
  recent: {
    orders: any[];
    expenses: any[];
    payments: any[];
  };
}
