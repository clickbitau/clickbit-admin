'use client';
import Link from 'next/link';
import { Megaphone as MegaphoneIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnnouncementTable } from '@/components/hr/AnnouncementTable';
import { fetchAnnouncements } from '@/lib/api';

export default function AdminHrAnnouncementsPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['announcements', token, page, search],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12 };
      if (search) params.search = search;
      return fetchAnnouncements(token, params);
    },
    enabled: !!token,
  });

  const announcements = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };

  return (
    <PageShell
      title="Announcements"
      icon={MegaphoneIcon}
      description="Company-wide announcements and updates."
      actions={<Button asChild><Link href="/admin/hr/announcements/new">New Announcement</Link></Button>}
    >

      <Input
        placeholder="Search announcements..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="sm:max-w-sm"
      />

      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-destructive">Failed to load announcements.</div> : <AnnouncementTable announcements={announcements} loading={isLoading} />}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {pagination.page} of {pagination.pages} ({pagination.total} total)
        </p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  );
}