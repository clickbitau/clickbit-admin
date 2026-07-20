'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchShifts } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { Shift } from '@/types/hr';

export default function EmployeeSchedulePage() {
  const { token } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const { data, isLoading } = useQuery({
    queryKey: ['employee-schedule', token, weekStart.toISOString()],
    queryFn: () => {
      if (!token) throw new Error('No token');
      return fetchShifts(token, {
        start_date: weekStart.toISOString().split('T')[0],
        end_date: weekEnd.toISOString().split('T')[0],
      });
    },
    enabled: !!token,
  });

  const shifts = useMemo(() => (data?.data as Shift[])?.filter((s: Shift) => s.status !== 'cancelled') ?? [], [data]);

  const days = useMemo(() => {
    const result: { date: Date; shifts: Shift[]; totalMinutes: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dayShifts = shifts.filter((s) => s.shift_date && new Date(s.shift_date).toDateString() === d.toDateString());
      const totalMinutes = dayShifts.reduce((sum, s) => sum + shiftMinutes(s), 0);
      result.push({ date: d, shifts: dayShifts, totalMinutes });
    }
    return result;
  }, [weekStart, shifts]);

  const totalWeekMinutes = useMemo(() => days.reduce((s, d) => s + d.totalMinutes, 0), [days]);

  return (
    <PageShell title="My Schedule" icon={CalendarDays} description="Weekly roster and expected hours.">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => moveWeek(weekStart, -7, setWeekStart)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium">{formatDate(weekStart)} - {formatDate(weekEnd)}</span>
          <Button variant="outline" size="sm" onClick={() => moveWeek(weekStart, 7, setWeekStart)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Card className="nm-raised px-4 py-2"><p className="text-xs text-muted-foreground">Expected hours</p><p className="text-lg font-bold">{(totalWeekMinutes / 60).toFixed(1)} hrs</p></Card>
      </div>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {days.map((day) => (
            <Card key={day.date.toISOString()} className="nm-raised">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs font-medium text-center">{day.date.toLocaleDateString('en-AU', { weekday: 'short' })}<br />{day.date.getDate()}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {day.shifts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">Off</p>
                ) : (
                  day.shifts.map((s) => (
                    <div key={s.id} className="text-xs p-2 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="font-medium">{formatTime(s.start_time)} - {formatTime(s.end_time)}</p>
                      <p className="text-muted-foreground">{(shiftMinutes(s) / 60).toFixed(1)} hrs</p>
                      {s.location && <p className="text-muted-foreground text-[10px] truncate">{s.location}</p>}
                    </div>
                  ))
                )}
                {day.totalMinutes > 0 && (
                  <p className="text-[10px] text-center text-muted-foreground pt-1 flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> {(day.totalMinutes / 60).toFixed(1)} hrs</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function moveWeek(current: Date, days: number, set: (d: Date) => void) {
  const d = new Date(current);
  d.setDate(d.getDate() + days);
  set(getWeekStart(d));
}

function formatTime(time?: string | null) {
  if (!time) return '-';
  const [h, m] = time.split(':');
  const date = new Date();
  date.setHours(Number(h), Number(m));
  return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

function shiftMinutes(shift: Shift) {
  if (!shift.start_time || !shift.end_time) return 0;
  const start = new Date(`1970-01-01T${shift.start_time}`);
  let end = new Date(`1970-01-01T${shift.end_time}`);
  if (end < start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  const breakMins = shift.scheduled_break_minutes || 0;
  return Math.max(0, (end.getTime() - start.getTime()) / 60000 - breakMins);
}
