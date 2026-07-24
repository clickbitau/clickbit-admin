export interface MonitoredSite {
  id: number;
  name: string;
  url: string | null;
  status: 'up' | 'down' | 'paused' | 'unknown';
  isUp: boolean;
  lastMessage: string | null;
  downSince: string | null;
  downtimeDuration: string | null;
  lastStatusChange: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoredSiteStats {
  total: number;
  up: number;
  down: number;
  paused: number;
  unknown: number;
}

export interface MonitoredSitesResponse {
  success: boolean;
  sites: MonitoredSite[];
  stats: MonitoredSiteStats;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  source?: string | null;
  monitor_name?: string | null;
  monitor_url?: string | null;
  status?: string | null;
  is_read?: boolean;
  read_at?: string | null;
  user_id?: number | null;
  metadata?: string | Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface NotificationsResponse {
  success: boolean;
  data: Notification[];
  unreadCount: number;
}
