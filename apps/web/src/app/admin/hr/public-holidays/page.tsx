'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PublicHolidayForm } from '@/components/hr/PublicHolidayForm';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchPublicHolidays, fetchHrStats } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { PublicHoliday } from '@/types/hr';
import { Calendar, Globe as GlobeIcon, Plus, Search } from 'lucide-react';

const locationOptions = ['All locations', 'Australia', 'Both', 'Global'];

export default function AdminHrPublicHolidaysPage() {
  const { token } = useAuth();
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((h: PublicHoliday) => (
            <Link key={h.id} href={`/admin/hr/public-holidays/${h.id}`} className="block group">
              <Card className="nm-raised h-full hover:brightness-[0.97] dark:hover:brightness-110 transition-all">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium line-clamp-2 group-hover:underline">{h.name}</h3>
                    <StatusBadge status={h.is_recurring ? 'recurring' : 'one-time'} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDate(h.holiday_date)}</span>
                    {h.location && <span className="flex items-center gap-1"><GlobeIcon className="h-4 w-4" /> {h.location}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-16 text-muted-foreground">No public holidays found. Try adjusting filters.</div>
          )}
        </div>
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
