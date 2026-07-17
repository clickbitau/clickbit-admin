export interface AnalyticsDashboard {
  pageViews: number;
  topPages: { page_url: string | null; visits: number }[];
  topReferrers: { referrer_url: string | null; visits: number }[];
  conversionStats: { event_type: string | null; conversions: number }[];
  utmStats: { utm_source: string | null; visits: number }[];
  deviceStats: { device_type: string | null; visits: number }[];
  geographicStats: { country: string | null; visits: number }[];
}

export interface AnalyticsEvent {
  id: number;
  event_type: string;
  event_name: string;
  page_url?: string | null;
  created_at: string;
  user_id?: number | null;
  device_type?: string | null;
  country?: string | null;
}
