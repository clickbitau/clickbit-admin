'use client';
import Link from 'next/link';
import { Megaphone as MegaphoneIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { Pagination } from '@/components/design-system/Pagination';

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

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-destructive">Failed to load announcements.</div> : <AnnouncementTable announcements={announcements} loading={isLoading} />}
        </CardContent>
      </Card>

      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.pages}
        totalItems={pagination.total}
        onPageChange={setPage}
      />
    </PageShell>
  );
}