'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/design-system/Pagination';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { AnnouncementForm } from '@/components/hr/AnnouncementForm';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchAnnouncements, fetchHrStats, updateAnnouncement, deleteAnnouncement } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Announcement } from '@/types/hr';
import {
  Megaphone as MegaphoneIcon,
  Plus,
  Search,
  Pin,
  Eye,
  Edit,
  Trash2,
  Bell,
  CheckCircle,
  Clock,
  Users,
  Calendar,
} from 'lucide-react';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const typeOptions = [
  { value: '', label: 'All types' },
  { value: 'general', label: 'General' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'policy', label: 'Policy' },
  { value: 'event', label: 'Event' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'training', label: 'Training' },
  { value: 'safety', label: 'Safety' },
  { value: 'reminder', label: 'Reminder' },
];

const sortOptions = [
  { value: 'publish_at', label: 'Publish date' },
  { value: 'created_at', label: 'Created' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
];

function getTypeColor(type?: string | null) {
  const colors: Record<string, string> = {
    general: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    policy: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    event: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    achievement: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    training: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    safety: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    reminder: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };
  return colors[type || 'general'] || colors.general;
}

function getTypeIcon(type?: string | null) {
  switch (type) {
    case 'urgent':
    case 'safety':
      return <Bell className="w-3.5 h-3.5" />;
    case 'achievement':
      return <CheckCircle className="w-3.5 h-3.5" />;
    case 'training':
      return <Clock className="w-3.5 h-3.5" />;
    default:
      return <MegaphoneIcon className="w-3.5 h-3.5" />;
  }
}

function getPriorityColor(priority?: string | null) {
  switch (priority) {
    case 'critical':
      return 'text-red-700 dark:text-red-400';
    case 'high':
      return 'text-red-500';
    case 'normal':
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
}

function snippet(text?: string | null) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').slice(0, 160);
}

function targetLabel(target?: string | null) {
  if (!target || target === 'all') return 'Everyone';
  return target.charAt(0).toUpperCase() + target.slice(1);
}

export default function AdminHrAnnouncementsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [sortBy, setSortBy] = useState('publish_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 12, sortBy, sortOrder };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (type) params.type = type;
    return params;
  }, [page, debouncedSearch, status, type, sortBy, sortOrder]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['announcements', queryParams],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAnnouncements(token, queryParams); },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
    enabled: !!token,
  });

  useRealtimeRefresh(['announcements'], ['announcements'], { enabled: !!token });

  const announcements = useMemo(() => data?.data ?? [], [data?.data]);
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at || b.publish_at || 0).getTime() - new Date(a.created_at || a.publish_at || 0).getTime();
    });
  }, [announcements]);

  const statCards = useMemo(() => {
    const total = stats?.announcements?.total ?? pagination.total ?? announcements.length;
    const published = stats?.announcements?.published ?? 0;
    const scheduled = stats?.announcements?.scheduled ?? 0;
    const draft = stats?.announcements?.draft ?? 0;
    return [
      { label: 'Total', value: total, icon: MegaphoneIcon },
      { label: 'Published', value: published, icon: MegaphoneIcon, accent: 'success' as const, onClick: () => { setStatus('published'); setPage(1); } },
      { label: 'Scheduled', value: scheduled, icon: MegaphoneIcon, accent: 'warning' as const, onClick: () => { setStatus('scheduled'); setPage(1); } },
      { label: 'Drafts', value: draft, icon: MegaphoneIcon, onClick: () => { setStatus('draft'); setPage(1); } },
    ];
  }, [stats, pagination.total, announcements.length]);

  const pinMutation = useMutation({
    mutationFn: ({ id, is_pinned }: { id: number; is_pinned: boolean }) => updateAnnouncement(token!, id, { is_pinned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateAnnouncement(token!, id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAnnouncement(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });

  function handleTogglePin(a: Announcement) {
    pinMutation.mutate({ id: Number(a.id), is_pinned: !a.is_pinned });
  }

  function handleTogglePublish(a: Announcement) {
    const currentStatus = a.status || 'draft';
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    publishMutation.mutate({ id: Number(a.id), status: newStatus });
  }

  return (
    <PageShell
      title="Announcements"
      icon={MegaphoneIcon}
      description="Create and manage company-wide announcements."
      actions={canManage ? <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Announcement</Button> : undefined}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="nm-raised p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search announcements..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>{typeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>{sortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load announcements.</div>
      ) : (
        <div className="space-y-4">
          {isLoading && sortedAnnouncements.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">Loading announcements…</div>
          ) : sortedAnnouncements.length === 0 ? (
            <div className="nm-raised p-12 text-center text-muted-foreground">
              <MegaphoneIcon className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No announcements found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            sortedAnnouncements.map((a: Announcement) => (
              <div
                key={a.id}
                className={`nm-raised p-5 ${a.is_pinned ? 'ring-1 ring-primary/20 border-primary/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {a.is_pinned && <Pin className="w-4 h-4 text-primary" />}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getTypeColor(a.type)}`}>
                        {getTypeIcon(a.type)}
                        {(a.type || 'general').charAt(0).toUpperCase() + (a.type || 'general').slice(1)}
                      </span>
                      {a.status && a.status !== 'published' && (
                        <StatusBadge status={a.status} />
                      )}
                      <span className={`text-xs ${getPriorityColor(a.priority)}`}>
                        {(a.priority || 'normal').charAt(0).toUpperCase() + (a.priority || 'normal').slice(1)} Priority
                      </span>
                    </div>

                    {a.featured_image && (
                      <div className="mb-3 rounded-lg overflow-hidden max-h-48">
                        <img src={a.featured_image} alt="" className="w-full h-44 object-cover" />
                      </div>
                    )}

                    <h3 className="text-lg font-semibold mb-2">
                      <Link href={`/admin/hr/announcements/${a.id}`} className="hover:underline">{a.title}</Link>
                    </h3>

                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{snippet(a.content)}</p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {formatDate(a.publish_at || a.created_at)}</span>
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {targetLabel(a.target_type)}</span>
                      {(a.view_count ?? 0) > 0 && <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {a.view_count} views</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/hr/announcements/${a.id}`)} title="View">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleTogglePin(a)}
                          title={a.is_pinned ? 'Unpin' : 'Pin'}
                          className={a.is_pinned ? 'text-primary' : ''}
                        >
                          <Pin className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleTogglePublish(a)}
                          title={a.status === 'published' ? 'Unpublish' : 'Publish'}
                        >
                          {a.status === 'published' ? <MegaphoneIcon className="w-4 h-4" /> : <MegaphoneIcon className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/hr/announcements/${a.id}`)} title="Edit">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(Number(a.id))} title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Pagination currentPage={pagination.page} totalPages={pagination.pages} totalItems={pagination.total} onPageChange={setPage} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>Publish a company-wide announcement.</DialogDescription>
          </DialogHeader>
          {token && (
            <AnnouncementForm
              token={token}
              onSuccess={() => setCreateOpen(false)}
              onCancel={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
