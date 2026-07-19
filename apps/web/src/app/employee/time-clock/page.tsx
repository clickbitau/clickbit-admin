'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { LocationMap } from '@/components/LocationMap';
import { fetchTimeClockStatus, clockIn, clockOut, startBreak, endBreak, fetchTimesheets } from '@/lib/api';
import { formatDate, formatDateTime, formatDuration } from '@/lib/format';
import { Clock, Play, Square, Coffee, Utensils, MapPin, ChevronLeft, ChevronRight, Locate } from 'lucide-react';
import { toast } from 'sonner';

interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
}

function toISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfWeek(d: Date) {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function getPosition(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation is not supported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function EmployeeTimeClockPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [week, setWeek] = useState<Date>(new Date());
  const [location, setLocation] = useState<Location | null>(null);
  const [locating, setLocating] = useState(false);

  const weekStart = useMemo(() => startOfWeek(week), [week]);
  const weekEnd = useMemo(() => endOfWeek(week), [week]);

  const statusQuery = useQuery({
    queryKey: ['time-clock-status', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimeClockStatus(token);
    },
    enabled: !!token,
  });

  const timesheetsQuery = useQuery({
    queryKey: ['employee-timesheets', token, toISODate(weekStart), toISODate(weekEnd)],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimesheets(token, { start_date: toISODate(weekStart), end_date: toISODate(weekEnd), limit: 100 });
    },
    enabled: !!token,
  });

  useEffect(() => {
    setLocating(true);
    getPosition()
      .then(setLocation)
      .catch(() => setLocation(null))
      .finally(() => setLocating(false));
  }, []);

  const status = statusQuery.data?.data;
  const activeEntry = status?.activeEntry;
  const isClockedIn = !!activeEntry;
  const isOnBreak = !!activeEntry?.isOnBreak;
  const requireGps = status?.employee?.requireGps;

  const entriesByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      map[toISODate(d)] = [];
    }
    const rows = timesheetsQuery.data?.data || [];
    for (const entry of rows) {
      const key = toISODate(new Date(entry.clock_in_time));
      if (map[key]) map[key].push(entry);
      else map[key] = [entry];
    }
    return map;
  }, [timesheetsQuery.data, weekStart]);

  async function captureLocation(): Promise<Location | null> {
    if (!requireGps) return location;
    try {
      const loc = await getPosition();
      setLocation(loc);
      return loc;
    } catch (err: any) {
      toast.error('GPS location is required to clock in/out');
      return null;
    }
  }

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      const loc = await captureLocation();
      if (requireGps && !loc) throw new Error('Location required');
      return clockIn(token, loc ? { latitude: String(loc.latitude), longitude: String(loc.longitude), accuracy: loc.accuracy ? String(loc.accuracy) : undefined, address: loc.address } : {});
    },
    onSuccess: () => {
      toast.success('Clocked in');
      queryClient.invalidateQueries({ queryKey: ['time-clock-status'] });
      queryClient.invalidateQueries({ queryKey: ['employee-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err?.message || 'Clock in failed'),
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      const loc = await captureLocation();
      const body: Record<string, unknown> = loc ? { latitude: String(loc.latitude), longitude: String(loc.longitude), accuracy: loc.accuracy ? String(loc.accuracy) : undefined, address: loc.address } : {};
      const current = statusQuery.data?.data?.activeEntry;
      if (current?.clockInTime) {
        const hours = ((Date.now() - new Date(current.clockInTime).getTime()) / 3600000).toFixed(2);
        body.work_items = [{ description: 'General work', hours_spent: hours }];
      }
      return clockOut(token, body);
    },
    onSuccess: () => {
      toast.success('Clocked out');
      queryClient.invalidateQueries({ queryKey: ['time-clock-status'] });
      queryClient.invalidateQueries({ queryKey: ['employee-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err?.message || 'Clock out failed'),
  });

  const startBreakMutation = useMutation({
    mutationFn: (breakType?: string) => startBreak(token!, breakType),
    onSuccess: () => {
      toast.success('Break started');
      queryClient.invalidateQueries({ queryKey: ['time-clock-status'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Start break failed'),
  });

  const endBreakMutation = useMutation({
    mutationFn: () => endBreak(token!),
    onSuccess: () => {
      toast.success('Break ended');
      queryClient.invalidateQueries({ queryKey: ['time-clock-status'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'End break failed'),
  });

  function changeWeek(offset: number) {
    const next = new Date(week);
    next.setDate(next.getDate() + offset * 7);
    setWeek(next);
  }

  if (statusQuery.isLoading) {
    return (
      <PageShell title="Time Clock" icon={Clock}>
        <Skeleton className="h-40 rounded-2xl" />
      </PageShell>
    );
  }

  const mapLat = activeEntry?.clockInLatitude ?? location?.latitude;
  const mapLng = activeEntry?.clockInLongitude ?? location?.longitude;

  return (
    <PageShell title="Time Clock" icon={Clock} description="Clock in/out, capture your location, and review your week.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="nm-raised">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isClockedIn ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                <Clock className="h-10 w-10" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">{isClockedIn ? (isOnBreak ? 'On Break' : 'Clocked In') : 'Clocked Out'}</p>
                {isClockedIn && activeEntry?.clockInTime && (
                  <p className="text-sm text-muted-foreground">Since {formatDateTime(activeEntry.clockInTime)}</p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {!isClockedIn ? (
                  <Button onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending || (requireGps && locating)}>
                    <Play className="mr-1 h-4 w-4" /> {clockInMutation.isPending ? 'Clocking in…' : 'Clock In'}
                  </Button>
                ) : (
                  <>
                    {isOnBreak ? (
                      <Button onClick={() => endBreakMutation.mutate()} disabled={endBreakMutation.isPending}>
                        <Coffee className="mr-1 h-4 w-4" /> End Break
                      </Button>
                    ) : (
                      <>
                        <Button onClick={() => clockOutMutation.mutate()} disabled={clockOutMutation.isPending}>
                          <Square className="mr-1 h-4 w-4" /> Clock Out
                        </Button>
                        <Button variant="outline" onClick={() => startBreakMutation.mutate('lunch')} disabled={startBreakMutation.isPending}>
                          <Utensils className="mr-1 h-4 w-4" /> Start Break
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="nm-raised">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mapLat && mapLng ? (
                <LocationMap latitude={mapLat} longitude={mapLng} height="180px" />
              ) : (
                <div className="h-[180px] nm-raised flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                  <MapPin className="h-6 w-6" />
                  <p>No location captured yet.</p>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={async () => { setLocating(true); try { setLocation(await getPosition()); } catch { toast.error('Could not get location'); } finally { setLocating(false); } }} disabled={locating}>
                <Locate className="mr-1 h-4 w-4" /> {locating ? 'Locating…' : 'Refresh location'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="nm-raised">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Today</span> <span>{formatDuration((status?.todayHours || 0) * 3600)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">This week</span> <span>{formatDuration((status?.weeklyHours || 0) * 3600)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Breaks</span> <span>{formatDuration((activeEntry?.totalBreakMinutes || 0) * 60)}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card className="nm-raised">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-medium">Recent Entries</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => changeWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm text-muted-foreground min-w-[140px] text-center">
                {formatDate(weekStart)} — {formatDate(weekEnd)}
              </span>
              <Button variant="outline" size="sm" onClick={() => changeWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setWeek(new Date())}>Today</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const day = new Date(weekStart);
              day.setDate(day.getDate() + i);
              const key = toISODate(day);
              const entries = entriesByDay[key] || [];
              return (
                <div key={key} className="nm-raised-sm p-2 min-h-[120px] flex flex-col">
                  <div className="text-xs font-medium text-muted-foreground mb-1 flex justify-between">
                    <span>{WEEKDAYS[i]}</span>
                    <span>{day.getDate()}</span>
                  </div>
                  <div className="flex-1 space-y-1.5 overflow-y-auto">
                    {entries.map((e: any) => (
                      <div key={e.id} className="text-xs p-1.5 rounded bg-primary/5 border border-border/50">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium">{formatTime(e.clock_in_time)}</span>
                          <StatusBadge status={e.status} className="text-[10px] px-1 py-0" />
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          {e.clock_out_time ? formatTime(e.clock_out_time) : '—'}
                          <span className="mx-1">·</span>
                          {e.total_minutes ? formatDuration(Number(e.total_minutes) * 60) : '-'}
                        </div>
                      </div>
                    ))}
                    {entries.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center mt-4">No entries</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
