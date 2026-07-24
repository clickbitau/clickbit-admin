'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
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
import {
  fetchMonitoredSites,
  clearAllMonitoredSites,
  updateMonitoredSiteStatus,
  deleteMonitoredSite,
} from '@/lib/api';
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

function getDowntimeDuration(site: MonitoredSite): string | null {
  if (site.downtimeDuration) return site.downtimeDuration;
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

  const clearAll = useMutation({
    mutationFn: () => clearAllMonitoredSites(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitored-sites', token] });
      toast.success('All sites cleared');
    },
    onError: () => toast.error('Failed to clear sites'),
  });

  const updateSite = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateMonitoredSiteStatus(token!, id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitored-sites', token] });
      toast.success('Site status updated');
    },
    onError: () => toast.error('Failed to update site status'),
  });

  const deleteSite = useMutation({
    mutationFn: (id: number) => deleteMonitoredSite(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitored-sites', token] });
      toast.success('Site removed');
    },
    onError: () => toast.error('Failed to remove site'),
  });

  const sites = useMemo(() => {
    const list = data?.sites ?? [];
    return [...list].sort((a, b) => {
      if (a.status === 'down' && b.status !== 'down') return -1;
      if (a.status !== 'down' && b.status === 'down') return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [data?.sites]);

  const stats = data?.stats ?? { total: 0, up: 0, down: 0, paused: 0, unknown: 0 };

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
      <div className="nm-raised p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 nm-inset-sm rounded-lg">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Site Monitoring</h2>
            <p className="text-sm text-muted-foreground">Uptime Kuma integration</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nm-raised p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 nm-inset-sm rounded-lg">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Site Monitoring</h2>
            <p className="text-sm text-muted-foreground">Uptime Kuma integration</p>
          </div>
        </div>
        <p className="text-sm text-destructive">Failed to load monitored sites.</p>
      </div>
    );
  }

  return (
    <div className="nm-raised p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 nm-inset-sm rounded-lg">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Site Monitoring</h2>
            <p className="text-sm text-muted-foreground">Uptime Kuma integration</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm nm-inset-sm rounded-lg p-1">
            <span className="px-3 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium whitespace-nowrap">
              {stats.up} up
            </span>
            {stats.down > 0 && (
              <span className="px-3 py-1 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium whitespace-nowrap animate-pulse">
                {stats.down} down
              </span>
            )}
            {stats.paused > 0 && (
              <span className="px-3 py-1 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium whitespace-nowrap">
                {stats.paused} paused
              </span>
            )}
            {stats.unknown > 0 && (
              <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground font-medium whitespace-nowrap">
                {stats.unknown} unknown
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-muted-foreground hover:text-primary nm-interactive rounded-lg transition-all duration-200"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {sites.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="p-2 text-muted-foreground hover:text-destructive nm-interactive rounded-lg transition-all duration-200"
              title="Clear all sites"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="text-center py-12 px-4 nm-inset-sm rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Globe className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No sites monitored</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Sites will appear here automatically when Uptime Kuma sends webhook notifications.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2">
          {sites.map((site) => (
            <div
              key={site.id}
              className={`nm-inset-sm rounded-xl p-3 flex items-center justify-between border-l-4 ${
                site.status === 'down'
                  ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10'
                  : site.status === 'up'
                    ? 'border-emerald-500'
                    : 'border-amber-500'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 relative">
                  {getStatusIcon(site.status)}
                  {site.status === 'down' && (
                    <span className="absolute top-0 right-0 flex h-2 w-2 -mt-1 -mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-sm truncate">{site.name}</h4>
                  <a
                    href={site.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline truncate block"
                    onClick={(e) => !site.url && e.preventDefault()}
                  >
                    {site.url || 'No URL provided'}
                  </a>
                </div>
              </div>

              <div className="flex flex-col items-end flex-shrink-0 ml-2 gap-1">
                {site.status === 'down' && getDowntimeDuration(site) ? (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    Down {getDowntimeDuration(site)}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground capitalize">{site.status}</span>
                )}
                <div className="flex items-center gap-1">
                  {site.url && (
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 nm-surface rounded-md text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {site.status !== 'up' && (
                    <button
                      type="button"
                      title="Mark as up"
                      onClick={() => updateSite.mutate({ id: site.id, status: 'up' })}
                      className="p-1 nm-surface rounded-md text-muted-foreground hover:text-emerald-500 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </button>
                  )}
                  {site.status !== 'down' && (
                    <button
                      type="button"
                      title="Mark as down"
                      onClick={() => updateSite.mutate({ id: site.id, status: 'down' })}
                      className="p-1 nm-surface rounded-md text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  )}
                  {site.status !== 'paused' && (
                    <button
                      type="button"
                      title="Mark as paused"
                      onClick={() => updateSite.mutate({ id: site.id, status: 'paused' })}
                      className="p-1 nm-surface rounded-md text-muted-foreground hover:text-amber-500 transition-colors"
                    >
                      <Pause className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => {
                      if (window.confirm(`Remove "${site.name}" from monitoring?`)) {
                        deleteSite.mutate(site.id);
                      }
                    }}
                    className="p-1 nm-surface rounded-md text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
