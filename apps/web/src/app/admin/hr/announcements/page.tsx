'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { AnnouncementForm } from '@/components/hr/AnnouncementForm';
import { Pagination } from '@/components/design-system/Pagination';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchAnnouncements, fetchHrStats } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Announcement } from '@/types/hr';
import { cn } from '@/lib/utils';
import { Megaphone as MegaphoneIcon, Plus, Search } from 'lucide-react';

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
  { value: 'company_news', label: 'Company news' },
  { value: 'policy', label: 'Policy' },
  { value: 'event', label: 'Event' },
  { value: 'urgent', label: 'Urgent' },
];

const sortOptions = [
  { value: 'publish_at', label: 'Publish date' },
  { value: 'created_at', label: 'Created' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
];

function priorityBorder(priority?: string | null) {
  switch (priority) {
    case 'urgent': return 'border-l-red-500';
    case 'high': return 'border-l-orange-500';
    case 'low': return 'border-l-gray-400';
    default: return 'border-l-blue-500';
  }
}

function snippet(text?: string | null) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').slice(0, 160);
}

export default function AdminHrAnnouncementsPage() {
  const { token } = useAuth();
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

  const announcements = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total', value: stats.announcements.total, icon: MegaphoneIcon },
      { label: 'Published', value: stats.announcements.published, icon: MegaphoneIcon, accent: 'success' as const, onClick: () => { setStatus('published'); setPage(1); } },
      { label: 'Scheduled', value: stats.announcements.scheduled, icon: MegaphoneIcon, accent: 'warning' as const, onClick: () => { setStatus('scheduled'); setPage(1); } },
      { label: 'Drafts', value: stats.announcements.draft, icon: MegaphoneIcon, onClick: () => { setStatus('draft'); setPage(1); } },
    ];
  }, [stats]);

  return (
    <PageShell
      title="Announcements"
      icon={MegaphoneIcon}
      description="Company-wide announcements and updates."
      actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Announcement</Button>}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {error ? (
        <div className="text-destructive text-sm">Failed to load announcements.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {announcements.map((a: Announcement) => (
            <Link key={a.id} href={`/admin/hr/announcements/${a.id}`} className="block group">
              <Card className={cn('nm-raised h-full overflow-hidden border-l-4 hover:brightness-[0.97] dark:hover:brightness-110 transition-all', priorityBorder(a.priority))}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium line-clamp-2 group-hover:underline">{a.title}</h3>
                    {a.is_pinned && <Badge variant="secondary" className="whitespace-nowrap">Pinned</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{snippet(a.content)}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={a.status || 'draft'} />
                    <span className="capitalize">{(a.type || 'general').replace(/_/g, ' ')}</span>
                    <span>{formatDate(a.publish_at)}</span>
                    {a.expires_at && <span>– {formatDate(a.expires_at)}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {announcements.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-16 text-muted-foreground">No announcements found. Try adjusting filters.</div>
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
