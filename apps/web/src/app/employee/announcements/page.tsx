'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/design-system/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPublicAnnouncements } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Megaphone, Pin } from 'lucide-react';
import type { Announcement } from '@clickbit/shared';

export default function EmployeeAnnouncementsPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['employee-announcements', token, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchPublicAnnouncements(token, { page, limit });
    },
    enabled: !!token,
  });

  const announcements = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <PageShell title="Announcements" icon={Megaphone} description="Company news and updates.">
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : announcements.length === 0 ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">No announcements.</Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a: Announcement) => (
            <Link key={a.id} href={`/employee/announcements/${a.id}`}>
              <Card className="nm-raised hover:-translate-y-0.5 transition-transform">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {a.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                    {a.title}
                  </CardTitle>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${priorityClass(a.priority)}`}>
                    {a.priority || 'general'}
                  </span>
                </CardHeader>
                <CardContent>
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

function priorityClass(priority?: string | null) {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'high': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'medium': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function stripHtml(html?: string | null) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
