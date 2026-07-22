'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/design-system/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPublicAnnouncements } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Megaphone, Pin, Search } from 'lucide-react';
import type { Announcement } from '@clickbit/shared';

const PRIORITY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'general', label: 'General' },
];

export default function EmployeeAnnouncementsPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [priority, setPriority] = useState('all');
  const [search, setSearch] = useState('');
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['employee-announcements', token, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchPublicAnnouncements(token, { page, limit });
    },
    enabled: !!token,
  });

  const announcements = useMemo(() => data?.data ?? [], [data]);
  const pagination = data?.pagination;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = announcements;
    if (priority !== 'all') rows = rows.filter((a) => (a.priority || 'general').toLowerCase() === priority);
    if (q) {
      rows = rows.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        stripHtml(a.content_html || a.content).toLowerCase().includes(q)
      );
    }
    return rows;
  }, [announcements, priority, search]);

  const stats = useMemo(() => ({
    total: announcements.length,
    pinned: announcements.filter((a) => a.is_pinned).length,
    critical: announcements.filter((a) => (a.priority || 'general').toLowerCase() === 'critical').length,
    high: announcements.filter((a) => (a.priority || 'general').toLowerCase() === 'high').length,
  }), [announcements]);

  return (
    <PageShell
      title="Announcements"
      icon={Megaphone}
      description="Company news and updates."
      actions={
        <div className="flex flex-wrap gap-2">
          {PRIORITY_TABS.map((p) => (
            <ButtonLike
              key={p.key}
              active={priority === p.key}
              onClick={() => { setPriority(p.key); setPage(1); }}
            >
              {p.label}
            </ButtonLike>
          ))}
        </div>
      }
    >
      <StatCards
        cards={[
          { label: 'Total', value: stats.total, icon: Megaphone, accent: 'primary' },
          { label: 'Pinned', value: stats.pinned, icon: Pin, accent: 'secondary' },
          { label: 'Critical', value: stats.critical, icon: Megaphone, accent: 'destructive' },
          { label: 'High', value: stats.high, icon: Megaphone, accent: 'warning' },
        ]}
      />

      <Card className="nm-raised p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search announcements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">
          {search || priority !== 'all' ? 'No announcements match your filters.' : 'No announcements.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a: Announcement) => (
            <Link key={a.id} href={`/employee/announcements/${a.id}`}>
              <Card className={cn('nm-raised hover:-translate-y-0.5 transition-transform border-l-4', priorityBorder(a.priority))}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 p-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {a.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                    {a.title}
                  </CardTitle>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${priorityClass(a.priority)}`}>
                    {a.priority || 'general'}
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">{stripHtml(a.content_html || a.content)}</p>
                  <p className="text-xs text-muted-foreground mt-2">{formatDate(a.publish_at || a.created_at)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {pagination && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={setPage}
        />
      )}
    </PageShell>
  );
}

function ButtonLike({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 transition-colors',
        active
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {children}
    </button>
  );
}

function priorityClass(priority?: string | null) {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'high': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'medium': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function priorityBorder(priority?: string | null) {
  switch (priority) {
    case 'critical': return 'border-l-red-500';
    case 'high': return 'border-l-amber-500';
    case 'medium': return 'border-l-blue-500';
    default: return 'border-l-gray-400';
  }
}

function stripHtml(html?: string | null) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
