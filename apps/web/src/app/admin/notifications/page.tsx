'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  RefreshCw,
  AlertCircle,
  Info,
  AlertTriangle,
  MailOpen,
  CheckCircle,
  Plus,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/design-system/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, deleteNotification, createNotification } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { Notification } from '@/types/notifications';

const TYPE_CONFIG: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
};

const SOURCE_LABELS: Record<string, string> = {
  ticket: 'Support Ticket',
  break_reminder: 'Break Reminder',
  shift_end_reminder: 'Shift Reminder',
  system: 'System',
  advance_request: 'Staff Advance',
  task: 'Task',
};

function fmtRelative(dateStr: string | Date | null | undefined) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  if (diffMin < 10080) return `${Math.floor(diffMin / 1440)}d ago`;
  return formatDate(dateStr);
}

function parseMetadata(metadata: Notification['metadata']): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try { return JSON.parse(metadata); } catch { return {}; }
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) return metadata as Record<string, unknown>;
  return {};
}

export default function NotificationsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deleting, setDeleting] = useState<Notification | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newNote, setNewNote] = useState({
    title: '',
    message: '',
    type: 'info',
    source: 'system',
    target: 'self',
    role: 'employee',
  });
  const canCreate = user?.role === 'admin' || user?.role === 'manager';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', token, filter],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchNotifications(token, { unread: filter === 'unread', limit: 200 });
    },
    enabled: !!token,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => markNotificationRead(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => toast.error('Failed to mark read'),
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All marked as read');
    },
    onError: () => toast.error('Failed to mark all read'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteNotification(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Failed to delete notification'),
  });

  const createMut = useMutation({
    mutationFn: () => {
      const base = {
        title: newNote.title,
        message: newNote.message,
        type: newNote.type,
        source: newNote.source,
      };
      if (newNote.target === 'broadcast') return createNotification(token!, { ...base, broadcast: true });
      if (newNote.target === 'role') return createNotification(token!, { ...base, role: newNote.role });
      return createNotification(token!, base);
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Notification created');
      setCreateOpen(false);
      setNewNote({ title: '', message: '', type: 'info', source: 'system', target: 'self', role: 'employee' });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create notification'),
  });

  const notifications = useMemo(() => data?.data ?? [], [data?.data]);
  const unreadCount = data?.unreadCount ?? 0;

  const availableSources = useMemo(() => Array.from(new Set(notifications.map((n) => n.source).filter((s): s is string => !!s))), [notifications]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (sourceFilter !== 'all' && n.source !== sourceFilter) return false;
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, sourceFilter, typeFilter]);

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id);
    const meta = parseMetadata(n.metadata);
    const url = meta.action_url;
    if (typeof url === 'string') router.push(url.startsWith('/') ? url : `/${url}`);
  };

  return (
    <PageShell
      title="Notifications"
      description={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
      icon={Bell}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border bg-muted p-0.5 nm-raised-sm">
            <Button variant={filter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter('all')}>All</Button>
            <Button variant={filter === 'unread' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter('unread')}>Unread</Button>
          </div>
          {availableSources.length > 1 && (
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm nm-raised-sm">
              <option value="all">All sources</option>
              {availableSources.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s ?? ''] ?? s}</option>)}
            </select>
          )}
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm nm-raised-sm">
            <option value="all">All types</option>
            {['info', 'warning', 'error', 'success'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <Card className="nm-raised"><CardContent className="p-6 text-sm text-muted-foreground">Loading...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="nm-raised">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MailOpen className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-base font-medium">No notifications</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              You do not have any notifications yet. System events like ticket assignments, reminders, and timesheet approvals will appear here.
            </p>
            {canCreate && (
              <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Megaphone className="mr-1 h-4 w-4" /> Send a notification
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => <NotificationCard key={n.id} notification={n} onMarkRead={() => markRead.mutate(n.id)} onDelete={() => setDeleting(n)} onClick={() => handleClick(n)} />)}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete notification"
        description={deleting ? `Delete "${deleting.title ?? 'this notification'}"?` : ''}
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
        loading={deleteMut.isPending}
        confirmLabel="Delete"
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={newNote.title} onChange={(e) => setNewNote({ ...newNote, title: e.target.value })} placeholder="e.g. System maintenance" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={newNote.message} onChange={(e) => setNewNote({ ...newNote, message: e.target.value })} rows={3} placeholder="Notification body" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <select value={newNote.type} onChange={(e) => setNewNote({ ...newNote, type: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  {['info', 'warning', 'error', 'success'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Input value={newNote.source} onChange={(e) => setNewNote({ ...newNote, source: e.target.value })} placeholder="system" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Send to</Label>
              <select value={newNote.target} onChange={(e) => setNewNote({ ...newNote, target: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="self">Yourself (test)</option>
                <option value="role">A role</option>
                <option value="broadcast">All users</option>
              </select>
            </div>
            {newNote.target === 'role' && (
              <div className="space-y-2">
                <Label>Role</Label>
                <select value={newNote.role} onChange={(e) => setNewNote({ ...newNote, role: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  {['admin', 'manager', 'employee', 'customer', 'agent'].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={!newNote.title.trim() || !newNote.message.trim() || createMut.isPending}>
              {createMut.isPending ? 'Sending...' : 'Send notification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  onClick,
}: {
  notification: Notification;
  onMarkRead: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const config = TYPE_CONFIG[notification.type || 'info'] ?? TYPE_CONFIG.info;
  const Icon = config.icon;

  return (
    <Card className={`nm-raised transition-opacity hover:bg-muted/30 ${notification.is_read ? 'opacity-70' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
          <button onClick={onClick} className="flex-1 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {!notification.is_read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary" />}
                  {notification.title || notification.type || 'Notification'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message || '-'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {notification.source && <Badge variant="outline">{SOURCE_LABELS[notification.source] ?? notification.source}</Badge>}
                  {notification.monitor_name && <span className="truncate max-w-xs">{notification.monitor_name}</span>}
                  {notification.status && <Badge variant="secondary">{notification.status}</Badge>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{fmtRelative(notification.created_at)}</p>
                <p className="text-[10px] text-muted-foreground">{notification.created_at ? formatDate(notification.created_at) : '-'}</p>
              </div>
            </div>
          </button>
          <div className="flex flex-col gap-1 shrink-0">
            {!notification.is_read && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onMarkRead(); }} title="Mark as read">
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
