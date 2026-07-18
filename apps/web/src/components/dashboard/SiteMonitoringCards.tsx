'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Globe,
  Pause,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { fetchMonitoredSites, updateMonitoredSiteStatus, clearAllMonitoredSites } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { MonitoredSite, MonitoredSiteStats } from '@/types/notifications';
import { toast } from 'sonner';

function getStatusIcon(status: string) {
  switch (status) {
    case 'up':
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case 'down':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'paused':
      return <Pause className="h-4 w-4 text-amber-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusGlow(status: string) {
  switch (status) {
    case 'up':
      return 'ring-emerald-400/60';
    case 'down':
      return 'ring-red-400/60';
    case 'paused':
      return 'ring-amber-400/60';
    default:
      return 'ring-muted-foreground/30';
  }
}

function getDowntimeDuration(site: MonitoredSite): string | null {
  if (site.status !== 'down' || !site.downSince) return null;
  const diffMs = Date.now() - new Date(site.downSince).getTime();
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function SiteMonitoringCards() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{
    success: boolean;
    sites: MonitoredSite[];
    stats: MonitoredSiteStats;
  }>({
    queryKey: ['monitored-sites', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchMonitoredSites(token);
    },
    enabled: !!token,
    refetchInterval: 60000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateMonitoredSiteStatus(token!, id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitored-sites', token] });
      toast.success('Site status updated');
    },
    onError: () => toast.error('Failed to update site status'),
  });

  const clearAll = useMutation({
    mutationFn: () => clearAllMonitoredSites(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitored-sites', token] });
      toast.success('All sites cleared');
    },
    onError: () => toast.error('Failed to clear sites'),
  });

  const sites = data?.sites ?? [];
  const stats = data?.stats ?? { total: 0, up: 0, down: 0, paused: 0 };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleClearAll = () => {
    if (!window.confirm('Remove all monitored sites? This cannot be undone.')) return;
    clearAll.mutate();
  };

  if (isLoading) {
    return (
      <div className="nm-raised p-4 sm:p-5">
        <div className="flex items-center gap-2 text-base font-semibold mb-3">
          <Activity className="h-4 w-4" /> Site Monitoring
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="nm-raised p-4 sm:p-5">
        <div className="flex items-center gap-2 text-base font-semibold mb-3">
          <Activity className="h-4 w-4" /> Site Monitoring
        </div>
        <p className="text-sm text-destructive">Failed to load monitored sites.</p>
      </div>
    );
  }

  return (
    <div className="nm-raised p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4" /> Site Monitoring
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className="nm-raised-sm inline-flex items-center gap-1 px-2 py-1 text-emerald-600 dark:text-emerald-400">
              {stats.up} up
            </span>
            {stats.down > 0 && (
              <span className="nm-raised-sm inline-flex items-center gap-1 px-2 py-1 text-red-600 dark:text-red-400 animate-pulse">
                {stats.down} down
              </span>
            )}
            {stats.paused > 0 && (
              <span className="nm-raised-sm inline-flex items-center gap-1 px-2 py-1 text-amber-600 dark:text-amber-400">
                {stats.paused} paused
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="nm-interactive rounded-lg" onClick={handleRefresh} disabled={refreshing} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          {sites.length > 0 && (
            <Button variant="ghost" size="icon" className="nm-interactive rounded-lg" onClick={handleClearAll} disabled={clearAll.isPending} title="Clear all sites">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="text-center py-8 nm-inset-sm rounded-xl text-muted-foreground">
          <Globe className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm font-medium">No sites monitored</p>
          <p className="text-xs">Sites will appear here when Uptime Kuma sends webhook notifications.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-1">
          {sites.map((site) => (
            <div
              key={site.id}
              className={`nm-raised-sm p-3 ring-1 ${statusGlow(site.status)} transition-all hover:-translate-y-0.5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative flex-shrink-0">
                    {getStatusIcon(site.status)}
                    {site.status === 'down' && (
                      <span className="absolute -right-1 -top-1 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold">{site.name}</h4>
                    {site.url ? (
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {site.url}
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">No URL provided</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  {site.status === 'down' && getDowntimeDuration(site) ? (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      Down {getDowntimeDuration(site)}
                    </span>
                  ) : (
                    <span className="text-xs capitalize text-muted-foreground">{site.status}</span>
                  )}
                  {site.url && (
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 text-muted-foreground hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={site.status}
                  onChange={(e) => updateStatus.mutate({ id: site.id, status: e.target.value })}
                  className="h-8 rounded-lg bg-background px-2 text-xs nm-interactive border-0"
                >
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="paused">Paused</option>
                  <option value="unknown">Unknown</option>
                </select>
                <span className="text-xs text-muted-foreground truncate">
                  {site.lastMessage ? `Last: ${site.lastMessage}` : `Updated ${formatDate(site.updatedAt)}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
