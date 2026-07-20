'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Coffee, MapPin, Play, Square, Users, Timer, Calendar, Plus, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { LocationMap } from '@/components/LocationMap';
import { clockIn, clockOut, endBreak, fetchMyTasks, fetchTasks, fetchTimeClockActive, fetchTimeClockStatus, fetchTimesheets, startBreak } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ProjectTask } from '@/types/crm';
import type { TimeEntry } from '@/types/hr';

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-AU');
}

function formatDurationSeconds(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

interface LocationState {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
}

interface WorkSelection {
  selected: boolean;
  hours: string;
  note: string;
}

interface AdHocItem {
  description: string;
  hours: string;
  task_id?: number;
}

export default function AdminHrTimeClockPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [now, setNow] = useState(Date.now());
  const [location, setLocation] = useState<LocationState | null>(null);
  const [locating, setLocating] = useState(false);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [myTasks, setMyTasks] = useState<ProjectTask[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Record<number, WorkSelection>>({});
  const [adhocItems, setAdHocItems] = useState<AdHocItem[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [fetchingTasks, setFetchingTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [week, setWeek] = useState<Date>(new Date());
  const [searchResults, setSearchResults] = useState<ProjectTask[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeAdhocIndex, setActiveAdhocIndex] = useState<number | null>(null);

  const [activeEntryCache, setActiveEntryCache] = useState<{ clockInTime?: string; isOnBreak?: boolean; totalBreakMinutes?: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('clickbit-admin-timeclock');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Date.now() - parsed.ts < 5 * 60 * 1000) {
          setActiveEntryCache(parsed.data);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['time-clock-status', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimeClockStatus(token);
    },
    enabled: !!token,
  });

  const status: Record<string, any> = data?.data || {};

  useEffect(() => {
    if (status?.activeEntry) {
      try {
        localStorage.setItem('clickbit-admin-timeclock', JSON.stringify({ ts: Date.now(), data: status.activeEntry }));
      } catch {
        // ignore
      }
    }
  }, [status?.activeEntry]);

  const activeEntry = status?.activeEntry || activeEntryCache;
  const clockedIn = !!activeEntry;
  const isOnBreak = activeEntry?.isOnBreak ?? false;

  const durationSeconds = useMemo(() => {
    if (!activeEntry || activeEntry.isOnBreak) return 0;
    const start = activeEntry.clock_in_time || activeEntry.clockInTime;
    if (!start) return 0;
    const started = new Date(start).getTime();
    const breakSeconds = (activeEntry.total_break_minutes || activeEntry.totalBreakMinutes || 0) * 60;
    return Math.max(0, Math.floor((now - started) / 1000) - breakSeconds);
  }, [now, activeEntry]);

  const weekStart = useMemo(() => startOfWeek(week), [week]);
  const weekEnd = useMemo(() => endOfWeek(week), [week]);

  const { data: timesheetsData, isLoading: loadingTimesheets } = useQuery({
    queryKey: ['admin-time-clock-entries', token, toISODate(weekStart), toISODate(weekEnd)],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number | boolean | undefined> = {
        start_date: toISODate(weekStart),
        end_date: toISODate(weekEnd),
        limit: 100,
      };
      if (status?.employee?.id) params.employee_id = status.employee.id;
      return fetchTimesheets(token, params);
    },
    enabled: !!token && !!status?.employee?.id,
  });

  const entriesByDay = useMemo(() => {
    const map: Record<string, TimeEntry[]> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      map[toISODate(d)] = [];
    }
    const rows = timesheetsData?.data || [];
    for (const entry of rows) {
      const key = toISODate(new Date(entry.clock_in_time));
      if (map[key]) map[key].push(entry);
      else map[key] = [entry];
    }
    return map;
  }, [timesheetsData, weekStart]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['time-clock-status', token] });
    queryClient.invalidateQueries({ queryKey: ['time-clock-active', token] });
    queryClient.invalidateQueries({ queryKey: ['admin-time-clock-entries', token] });
  };

  const { data: activeData, isLoading: loadingActive } = useQuery({
    queryKey: ['time-clock-active', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimeClockActive(token);
    },
    enabled: !!token && isManager,
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      const body: Record<string, unknown> = {};
      if (location) {
        body.latitude = String(location.latitude);
        body.longitude = String(location.longitude);
        body.address = location.address;
      }
      return clockIn(token, body);
    },
    onSuccess: () => {
      toast.success('Clocked in');
      refresh();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to clock in');
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (!token) throw new Error('No token');
      return clockOut(token, body);
    },
    onSuccess: (res: any) => {
      const msg = res?.data?.formattedDuration ? `Clocked out. Total: ${res.data.formattedDuration}` : 'Clocked out';
      toast.success(msg);
      setSummaryOpen(false);
      setSelectedTasks({});
      setAdHocItems([]);
      setSessionNotes('');
      refresh();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to clock out');
    },
  });

  const breakStartMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      return startBreak(token, 'general');
    },
    onSuccess: refresh,
  });

  const breakEndMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      return endBreak(token);
    },
    onSuccess: refresh,
  });

  const captureLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true },
    );
  };

  const activeEmployees = (activeData?.data || []) as any[];
  const activeCount = activeEmployees.length;
  const onBreakCount = activeEmployees.filter((e) => e.is_on_break).length;

  const statCards = [
    { label: 'Current Time', value: formatTime(new Date(now)), icon: Clock },
    { label: 'Status', value: clockedIn ? (isOnBreak ? 'On Break' : 'Clocked In') : 'Clocked Out', icon: Clock, accent: clockedIn ? (isOnBreak ? ('warning' as const) : ('success' as const)) : undefined },
    { label: "Today's Hours", value: Number(status?.todayHours || 0).toFixed(2), icon: Timer },
    { label: 'This Week', value: Number(status?.weeklyHours || 0).toFixed(2), icon: Calendar },
    ...(isManager ? [{ label: 'Active Employees', value: activeCount, icon: Users, accent: activeCount ? ('primary' as const) : undefined }] : []),
    ...(isManager ? [{ label: 'On Break (team)', value: onBreakCount, icon: Coffee, accent: onBreakCount ? ('warning' as const) : undefined }] : []),
  ];

  const openWorkSummary = async () => {
    if (!activeEntry) return;
    if (durationSeconds < 15 * 60) {
      clockOutMutation.mutate({});
      return;
    }
    setSummaryOpen(true);
    setFetchingTasks(true);
    try {
      const tasks = await fetchMyTasks(token!, false);
      setMyTasks(tasks);
      const pre: Record<number, WorkSelection> = {};
      tasks.filter((t) => t.status === 'in_progress').forEach((t) => {
        pre[Number(t.id)] = { selected: true, hours: '', note: '' };
      });
      setSelectedTasks(pre);
    } catch {
      setMyTasks([]);
    } finally {
      setFetchingTasks(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const params: Record<string, string | number> = { search: query, limit: 10 };
      if (user?.id) params.assigned_to = Number(user.id);
      const result = await fetchTasks(token!, params);
      setSearchResults(result.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addAdHocItem = () => {
    setAdHocItems((prev) => [...prev, { description: '', hours: '' }]);
  };

  const submitClockOut = () => {
    const hasTask = Object.values(selectedTasks).some((t) => t.selected);
    const hasAdhoc = adhocItems.some((i) => i.description.trim() && Number(i.hours) > 0);
    if (!hasTask && !hasAdhoc) {
      toast.error('Please select at least one task or add a work item');
      return;
    }

    const workItems: any[] = [];
    Object.entries(selectedTasks).forEach(([taskId, sel]) => {
      if (sel.selected && Number(sel.hours) > 0) {
        workItems.push({ task_id: String(taskId), description: sel.note || '', hours_spent: String(sel.hours) });
      }
    });
    adhocItems.forEach((item) => {
      if (item.description.trim() && Number(item.hours) > 0) {
        workItems.push({
          task_id: item.task_id ? String(item.task_id) : undefined,
          description: item.description.trim(),
          hours_spent: String(item.hours),
        });
      }
    });

    const body: Record<string, unknown> = { work_items: workItems, session_notes: sessionNotes };
    if (location) {
      body.latitude = String(location.latitude);
      body.longitude = String(location.longitude);
      body.address = location.address;
    }
    clockOutMutation.mutate(body);
  };

  const statusColor = clockedIn ? (isOnBreak ? 'bg-yellow-500' : 'bg-green-500') : 'bg-gray-400';

  return (
    <PageShell title="Time Clock" icon={Clock} description="Clock in and out, track breaks, and manage the team's active sessions.">
      <StatCards cards={statCards} />

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle>Current Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && <div className="text-destructive">Failed to load time clock status.</div>}
          {isLoading && <Skeleton className="h-20" />}

          {!isLoading && status && (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${statusColor} ${clockedIn && !isOnBreak ? 'animate-pulse' : ''}`} />
                    <span className="font-medium">
                      {clockedIn ? (isOnBreak ? 'On Break' : 'Clocked In') : 'Clocked Out'}
                    </span>
                    {status?.employee?.name && (
                      <span className="text-sm text-muted-foreground">— {status.employee.name}</span>
                    )}
                  </div>
                  {activeEntry && (
                    <div className="text-sm text-muted-foreground">
                      Started {formatDateTime(activeEntry.clock_in_time || activeEntry.clockInTime)}
                      {activeEntry.clock_in_address || activeEntry.clockInAddress ? ` — ${activeEntry.clock_in_address || activeEntry.clockInAddress}` : ''}
                    </div>
                  )}
                </div>
                {clockedIn && (
                  <div className="text-center sm:text-right">
                    <div className="text-4xl font-mono font-bold">{formatDurationSeconds(durationSeconds)}</div>
                    <div className="text-xs text-muted-foreground">Current session</div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {location && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" />
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    {location.address ? ` — ${location.address}` : ''}
                    {typeof location.accuracy === 'number' && ` (±${Math.round(location.accuracy)}m)`}
                  </Badge>
                )}
                {status?.todayShift && (
                  <Badge variant="secondary" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    Shift {status.todayShift.start_time} - {status.todayShift.end_time}
                    {status.todayShift.location ? ` at ${status.todayShift.location}` : ''}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={captureLocation} variant="outline" disabled={locating} size="sm">
                  <MapPin className="mr-2 h-4 w-4" />
                  {locating ? 'Locating...' : location ? 'Update Location' : 'Capture Location'}
                </Button>

                {!clockedIn ? (
                  <Button onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending} size="sm">
                    {clockInMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Clock In
                  </Button>
                ) : (
                  <Button onClick={openWorkSummary} disabled={clockOutMutation.isPending} variant="destructive" size="sm">
                    {clockOutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                    Clock Out
                  </Button>
                )}

                {clockedIn && !isOnBreak && (
                  <Button onClick={() => breakStartMutation.mutate()} disabled={breakStartMutation.isPending} variant="outline" size="sm">
                    <Coffee className="mr-2 h-4 w-4" /> Start Break
                  </Button>
                )}

                {clockedIn && isOnBreak && (
                  <Button onClick={() => breakEndMutation.mutate()} disabled={breakEndMutation.isPending} variant="default" size="sm">
                    <Coffee className="mr-2 h-4 w-4" /> End Break
                  </Button>
                )}
              </div>

              {activeEntry && (activeEntry.total_break_minutes || activeEntry.totalBreakMinutes) > 0 && (
                <div className="text-sm text-muted-foreground">
                  Total break time: {activeEntry.total_break_minutes || activeEntry.totalBreakMinutes} minutes
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4" /> Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          {location || activeEntry?.clockInLatitude ? (
            <LocationMap
              latitude={activeEntry?.clockInLatitude ?? location?.latitude}
              longitude={activeEntry?.clockInLongitude ?? location?.longitude}
              height="180px"
            />
          ) : (
            <div className="h-[180px] nm-raised flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
              <MapPin className="h-6 w-6" />
              <p>No location captured yet.</p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={captureLocation}
            disabled={locating}
          >
            <MapPin className="mr-2 h-4 w-4" />
            {locating ? 'Locating…' : location ? 'Update Location' : 'Capture Location'}
          </Button>
        </CardContent>
      </Card>

      {isManager && (
        <Card className="nm-raised">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Active Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActive && <Skeleton className="h-20" />}
            {!loadingActive && activeEmployees.length === 0 && (
              <p className="text-sm text-muted-foreground">No one is currently clocked in.</p>
            )}
            {!loadingActive && activeEmployees.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeEmployees.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.employee_name}</TableCell>
                      <TableCell>{formatDateTime(entry.clock_in_time)}</TableCell>
                      <TableCell>{entry.formatted_duration || formatDurationSeconds(entry.duration_minutes ? entry.duration_minutes * 60 : 0)}</TableCell>
                      <TableCell>
                        {entry.is_on_break ? (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">On Break</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>{entry.department || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="nm-raised">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Recent Entries
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setWeek((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs text-muted-foreground min-w-[140px] text-center">{formatDate(weekStart)} — {formatDate(weekEnd)}</span>
              <Button variant="outline" size="sm" onClick={() => setWeek((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setWeek(new Date())}>Today</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTimesheets ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayLabel, i) => {
                const day = new Date(weekStart);
                day.setDate(day.getDate() + i);
                const key = toISODate(day);
                const entries = entriesByDay[key] || [];
                return (
                  <div key={key} className="nm-raised-sm p-2 min-h-[120px] flex flex-col">
                    <div className="text-xs font-medium text-muted-foreground mb-1 flex justify-between">
                      <span>{dayLabel}</span>
                      <span>{day.getDate()}</span>
                    </div>
                    <div className="flex-1 space-y-1.5 overflow-y-auto">
                      {entries.map((e: TimeEntry) => (
                        <div key={e.id} className="text-xs p-1.5 rounded bg-primary/5 border border-border/50">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium">{formatDateTime(e.clock_in_time)}</span>
                            <StatusBadge status={e.status} className="text-[10px] px-1 py-0" />
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            {e.clock_out_time ? formatDateTime(e.clock_out_time) : '—'}
                            <span className="mx-1">·</span>
                            {e.total_minutes ? `${Math.round(Number(e.total_minutes) / 6) / 10}h` : '-'}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> End of Day Summary
            </DialogTitle>
            <DialogDescription>Record what you worked on before clocking out.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 py-2">
            <div>
              <h4 className="text-sm font-semibold mb-2">Your Assigned Tasks</h4>
              {fetchingTasks ? (
                <Skeleton className="h-20" />
              ) : myTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active tasks assigned to you.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {myTasks.map((task) => {
                    const taskId = Number(task.id);
                    const state = selectedTasks[taskId] || { selected: false, hours: '', note: '' };
                    return (
                      <div
                        key={taskId}
                        className={`rounded-lg border p-3 transition-colors ${state.selected ? 'border-primary bg-primary/5' : 'border-border'}`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={state.selected}
                            onChange={(e) => setSelectedTasks((prev) => ({ ...prev, [taskId]: { ...state, selected: e.target.checked } }))}
                            className="mt-1 h-4 w-4 rounded border-input"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{task.title}</p>
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {task.status?.replace('_', ' ')}
                              </Badge>
                            </div>
                            {(task.crmProject?.name || task.project?.title) && <p className="text-xs text-muted-foreground truncate">{task.crmProject?.name || task.project?.title}</p>}
                            {state.selected && (
                              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                                <Input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  placeholder="Hours"
                                  value={state.hours}
                                  onChange={(e) => setSelectedTasks((prev) => ({ ...prev, [taskId]: { ...state, hours: e.target.value } }))}
                                  className="w-24"
                                />
                                <Input
                                  placeholder="What did you do? (optional)"
                                  value={state.note}
                                  onChange={(e) => setSelectedTasks((prev) => ({ ...prev, [taskId]: { ...state, note: e.target.value } }))}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Other Work</h4>
              <div className="space-y-2">
                {adhocItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Search tasks or type a description"
                        value={item.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAdHocItems((prev) => prev.map((it, i) => (i === idx ? { ...it, description: val, task_id: undefined } : it)));
                          setActiveAdhocIndex(idx);
                          if (val.length >= 2) handleSearch(val);
                        }}
                        onFocus={() => {
                          if (item.description.length >= 2) {
                            setActiveAdhocIndex(idx);
                            handleSearch(item.description);
                          }
                        }}
                        onBlur={() => setTimeout(() => setActiveAdhocIndex(null), 200)}
                      />
                      {activeAdhocIndex === idx && (searchResults.length > 0 || searching) && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg max-h-40 overflow-y-auto">
                          {searching ? (
                            <div className="p-3 text-sm text-center text-muted-foreground">Searching...</div>
                          ) : (
                            searchResults.map((task) => (
                              <button
                                key={task.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                                onClick={() => {
                                  setAdHocItems((prev) => prev.map((it, i) => (i === idx ? { ...it, description: task.title || '', task_id: Number(task.id) } : it)));
                                  setSearchResults([]);
                                  setActiveAdhocIndex(null);
                                }}
                              >
                                <div className="font-medium truncate">{task.title}</div>
                                {(task.crmProject?.name || task.project?.title) && <div className="text-xs text-muted-foreground truncate">{task.crmProject?.name || task.project?.title}</div>}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      placeholder="Hrs"
                      className="w-24"
                      value={item.hours}
                      onChange={(e) => setAdHocItems((prev) => prev.map((it, i) => (i === idx ? { ...it, hours: e.target.value } : it)))}
                    />
                    <Button variant="ghost" size="icon" onClick={() => setAdHocItems((prev) => prev.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addAdHocItem}>
                  <Plus className="mr-2 h-4 w-4" /> Add Work Item
                </Button>
              </div>
            </div>

            <div>
              <Label>Session Notes (optional)</Label>
              <Textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Any general notes about today's work..."
                rows={2}
              />
            </div>

            <div className="rounded-md bg-muted p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Clocked duration:</span>
              <span className="font-medium">{formatDurationSeconds(durationSeconds)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSummaryOpen(false)}>Cancel</Button>
            <Button onClick={submitClockOut} disabled={clockOutMutation.isPending} variant="destructive">
              {clockOutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
              Submit & Clock Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
