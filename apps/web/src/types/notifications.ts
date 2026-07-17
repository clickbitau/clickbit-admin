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
}

export interface MonitoredSitesResponse {
  success: boolean;
  sites: MonitoredSite[];
  stats: MonitoredSiteStats;
}
