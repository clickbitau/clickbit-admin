'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BellDot, Check, MailOpen, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { Notification } from '@/types/notifications';

export default function NotificationsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', token, filter],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchNotifications(token, { unread: filter === 'unread', limit: 100 });
    },
    enabled: !!token,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => markNotificationRead(token!, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); toast.success('Marked as read'); },
    onError: () => toast.error('Failed to mark read'),
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(token!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); toast.success('All marked as read'); },
    onError: () => toast.error('Failed to mark all read'),
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <PageShell
      title="Notifications"
      icon={BellDot}
      description={`You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
      actions={
        <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending || unreadCount === 0}>
          <Check className="mr-1 h-4 w-4" /> Mark all read
        </Button>
      }
    >
      <div className="flex gap-2">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button>
        <Button variant={filter === 'unread' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('unread')}>Unread</Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <MailOpen className="h-4 w-4" /> No notifications.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => <NotificationCard key={n.id} notification={n} onMarkRead={() => markRead.mutate(n.id)} />)}
        </div>
      )}
    </PageShell>
  );
}

function NotificationCard({ notification, onMarkRead }: { notification: Notification; onMarkRead: () => void }) {
  return (
    <Card className={notification.is_read ? 'opacity-70' : ''}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="flex-1">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {!notification.is_read && <Badge variant="default" className="h-2 w-2 rounded-full p-0" />}
            {notification.title || notification.type || 'Notification'}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{notification.message || '-'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{formatDate(notification.created_at)}</p>
          {!notification.is_read && (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onMarkRead}>
              <MailOpen className="h-3.5 w-3.5 mr-1" /> Read
            </Button>
          )}
        </div>
      </CardHeader>
      {(notification.source || notification.monitor_name || notification.status) && (
        <CardContent className="pt-0 text-xs text-muted-foreground flex flex-wrap gap-2">
          {notification.source && <Badge variant="outline">{notification.source}</Badge>}
          {notification.monitor_name && <span className="truncate max-w-xs">{notification.monitor_name}</span>}
          {notification.status && <Badge variant="secondary">{notification.status}</Badge>}
        </CardContent>
      )}
    </Card>
  );
}
