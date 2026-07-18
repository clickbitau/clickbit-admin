'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/api';
import { formatDistanceToNow } from '@/lib/format';
import type { Notification } from '@/types/notifications';

const TYPE_ICONS: Record<string, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const TYPE_COLORS: Record<string, string> = {
  info: 'text-blue-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
};

export function NotificationBell() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const countQuery = useQuery({
    queryKey: ['notifications-unread-count', token],
    queryFn: async () => {
      if (!token) return { unreadCount: 0 };
      return fetchNotifications(token, { unread: true, limit: 1 });
    },
    enabled: !!token,
    refetchInterval: 60000,
  });

  const listQuery = useQuery({
    queryKey: ['notifications-dropdown', token, open],
    queryFn: async () => {
      if (!token || !open) return { data: [], unreadCount: 0 };
      return fetchNotifications(token, { limit: 15 });
    },
    enabled: !!token && open,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => markNotificationRead(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-dropdown'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-dropdown'] });
    },
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notifications = (listQuery.data?.data ?? []) as Notification[];
  const unreadCount = countQuery.data?.unreadCount ?? 0;

  async function handleClick(n: Notification) {
    if (!n.is_read) await markReadMutation.mutateAsync(n.id);
    setOpen(false);
    const actionUrl = (n as any).action_url || (n as any).metadata?.action_url;
    if (actionUrl && typeof actionUrl === 'string') {
      router.push(actionUrl);
    } else {
      router.push('/admin/notifications');
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-muted-foreground hover:nm-raised-sm hover:text-foreground transition-all"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-background">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 nm-raised rounded-xl z-50 overflow-hidden border border-border/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <h3 className="text-sm font-semibold">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type || 'info'] || Info;
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-border/50 hover:bg-primary/5 cursor-pointer transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                    onClick={() => handleClick(n)}
                  >
                    <div className="flex gap-3">
                      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${TYPE_COLORS[n.type || 'info']}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'text-muted-foreground'}`}>{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{n.created_at ? formatDistanceToNow(n.created_at) : ''}</p>
                      </div>
                      {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border/50">
            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              className="block w-full px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              View All Notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
