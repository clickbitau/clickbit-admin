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
import { StatCards } from '@/components/design-system/StatCards';
import { PublicHolidayForm } from '@/components/hr/PublicHolidayForm';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchPublicHolidays, fetchHrStats } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { PublicHoliday } from '@/types/hr';
import { Globe as GlobeIcon, Plus, Search, Calendar, Repeat } from 'lucide-react';

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

  const holidays = useMemo(() => data?.data ?? [], [data?.data]);
  const count = data?.count ?? 0;
  const stats = statsData?.data;

  const filtered = useMemo(() => {
    return holidays.filter((h) => {
      const matchesLocation = location === 'All locations' || !h.location || h.location === location || h.location === 'Both' || h.location === 'Global';
      const matchesSearch = !search || h.name.toLowerCase().includes(search.toLowerCase()) || (h.location || '').toLowerCase().includes(search.toLowerCase());
      return matchesLocation && matchesSearch;
    });
  }, [holidays, location, search]);

  const statCards = useMemo(() => {
    const total = stats?.publicHolidays?.total ?? count ?? holidays.length;
    const upcoming = stats?.publicHolidays?.upcoming ?? holidays.filter((h) => new Date(h.holiday_date) >= new Date()).length;
    const recurring = holidays.filter((h) => h.is_recurring).length;
    const oneTime = holidays.filter((h) => !h.is_recurring).length;
    return [
      { label: 'Total', value: total, icon: GlobeIcon },
      { label: 'Upcoming', value: upcoming, icon: Calendar, accent: 'success' as const },
      { label: 'Recurring', value: recurring, icon: Repeat },
      { label: 'One-time', value: oneTime, icon: Calendar },
    ];
  }, [stats, count, holidays]);

  return (
    <PageShell
      title="Public Holidays"
      icon={GlobeIcon}
      description="Manage public holidays and regional calendars."
      actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Public Holiday</Button>}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="nm-raised p-4">
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
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load public holidays.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading && filtered.length === 0 ? (
            <div className="col-span-full flex items-center justify-center h-64 text-muted-foreground">Loading public holidays…</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full nm-raised p-12 text-center text-muted-foreground">
              <GlobeIcon className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No public holidays found</p>
              <p className="text-sm mt-1">Try a different year or location.</p>
            </div>
          ) : (
            filtered.map((h: PublicHoliday) => (
              <Link key={h.id} href={`/admin/hr/public-holidays/${h.id}`} className="block group">
                <Card className="nm-raised h-full hover:brightness-[0.97] dark:hover:brightness-110 transition-all">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium line-clamp-2 group-hover:underline">{h.name}</h3>
                      {h.is_recurring ? (
                        <Badge variant="secondary" className="whitespace-nowrap flex items-center gap-1"><Repeat className="w-3 h-3" /> Recurring</Badge>
                      ) : (
                        <Badge variant="outline" className="whitespace-nowrap">One-time</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDate(h.holiday_date)}</span>
                      {h.location && <span className="flex items-center gap-1"><GlobeIcon className="h-4 w-4" /> {h.location}</span>}
                    </div>
                    {h.notes && <p className="text-sm text-muted-foreground line-clamp-2">{h.notes}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))
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
