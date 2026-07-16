'use client';
import { Globe as GlobeIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

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

  return (
    <PageShell
      title="Public Holidays"
      icon={GlobeIcon}
      description="Manage public holidays and regional calendars."
    >

      <Input
        placeholder="Search public holidays..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-sm"
      />

      <Card>
        <CardHeader>
          <CardTitle>Public Holidays</CardTitle>
        </CardHeader>
        <CardContent>{error ? <div className="text-destructive">Failed to load public holidays.</div> : <PublicHolidayTable holidays={holidays} loading={isLoading} />}</CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} holidays</p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  );
}