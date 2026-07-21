'use client';
import { Globe as GlobeIcon, Plus } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { Pagination } from '@/components/design-system/Pagination';
import { PublicHolidayForm } from '@/components/hr/PublicHolidayForm';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicHolidayTable } from '@/components/hr/PublicHolidayTable';
import { fetchPublicHolidays } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminHrPublicHolidaysPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

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
      actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Public Holiday</Button>}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Public Holiday</DialogTitle>
            <DialogDescription>Add a public holiday to the calendar.</DialogDescription>
          </DialogHeader>
          {token && (
            <PublicHolidayForm
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