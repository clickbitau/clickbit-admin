'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
import { DataTable } from '@/components/design-system/DataTable';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PublicHolidayForm } from '@/components/hr/PublicHolidayForm';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchPublicHolidays, fetchHrStats } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { PublicHoliday } from '@/types/hr';
import { Globe as GlobeIcon, Plus, Search } from 'lucide-react';

const locationOptions = ['All locations', 'Australia', 'Both', 'Global'];

export default function AdminHrPublicHolidaysPage() {
  const { token } = useAuth();
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [location, setLocation] = useState('All locations');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-holidays', token, year],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchPublicHolidays(token, { year }); },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
    enabled: !!token,
  });

  useRealtimeRefresh(['public-holidays'], ['public-holidays'], { enabled: !!token });

  const stats = statsData?.data;
  const count = data?.count ?? 0;

  const filtered = useMemo(() => {
    return (data?.data ?? []).filter((h) => {
      const matchesLocation = location === 'All locations' || !h.location || h.location === location || h.location === 'Both' || h.location === 'Global';
      const matchesSearch = !search || h.name.toLowerCase().includes(search.toLowerCase()) || (h.location || '').toLowerCase().includes(search.toLowerCase());
      return matchesLocation && matchesSearch;
    });
  }, [data, location, search]);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total', value: stats.publicHolidays.total, icon: GlobeIcon },
      { label: 'Upcoming', value: stats.publicHolidays.upcoming, icon: GlobeIcon, accent: 'success' as const },
      { label: 'Loaded', value: count, icon: GlobeIcon },
    ];
  }, [stats, count]);

  return (
    <PageShell
      title="Public Holidays"
      icon={GlobeIcon}
      description="Manage public holidays and regional calendars."
      actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Public Holiday</Button>}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search holidays..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" />
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent>{locationOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load public holidays.</div>
      ) : (
        <DataTable
          headers={[
            { key: 'name', label: 'Name' },
            { key: 'date', label: 'Date' },
            { key: 'location', label: 'Location' },
            { key: 'recurring', label: 'Recurring' },
            { key: 'year', label: 'Year' },
          ]}
          data={filtered}
          keyExtractor={(h) => h.id}
          loading={isLoading}
          onRowClick={(h) => router.push(`/admin/hr/public-holidays/${h.id}`)}
          emptyText="No public holidays found."
          emptyDescription="Try adjusting year, location, or search."
          renderRow={(h: PublicHoliday) => [
            <Link key="name" href={`/admin/hr/public-holidays/${h.id}`} className="font-medium hover:underline">{h.name}</Link>,
            <span key="date">{formatDate(h.holiday_date)}</span>,
            <span key="location">{h.location || '-'}</span>,
            <StatusBadge key="recurring" status={h.is_recurring ? 'yes' : 'no'} />,
            <span key="year">{h.holiday_date ? new Date(h.holiday_date).getFullYear() : '-'}</span>,
          ]}
        />
      )}

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
