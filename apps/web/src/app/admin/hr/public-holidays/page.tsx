'use client';
import Link from 'next/link';
import { Globe as GlobeIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { Pagination } from '@/components/design-system/Pagination';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicHolidayTable } from '@/components/hr/PublicHolidayTable';
import { fetchPublicHolidays } from '@/lib/api';

export default function AdminHrPublicHolidaysPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-holidays', token, page, search],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12 };
      if (search) params.search = search;
      return fetchPublicHolidays(token, params);
    },
    enabled: !!token,
  });

  const holidays = data?.data ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / 12) || 1;

  return (
    <PageShell
      title="Public Holidays"
      icon={GlobeIcon}
      description="Manage public holidays and regional calendars."
      actions={<Button asChild><Link href="/admin/hr/public-holidays/new">New Public Holiday</Link></Button>}
    >

      <Input
        placeholder="Search public holidays..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="sm:max-w-sm"
      />

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle>Public Holidays</CardTitle>
        </CardHeader>
        <CardContent>{error ? <div className="text-destructive">Failed to load public holidays.</div> : <PublicHolidayTable holidays={holidays} loading={isLoading} />}</CardContent>
      </Card>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setPage}
      />
    </PageShell>
  );
}