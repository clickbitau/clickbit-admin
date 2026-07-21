'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar, CheckCircle, Clock, Coffee, Copy, Download, Edit, Eye, FileClock, Gift, Loader2, MapPin,
  Play, Plus, Send, Square, Trash2, Umbrella, User, UserMinus, XCircle, ChevronLeft, ChevronRight,
  DollarSign, Search, X
} from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { Pagination } from '@/components/design-system/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { Employee, PublicHoliday, Shift, TimeEntry, TimeOffRequest } from '@/types/hr';
import { ProjectTask } from '@/types/crm';
import {
  addTimesheetWorkItem,
  approveTimesheet,
  batchCreateShifts,
  copyShiftsWeek,
  createManualTimesheet,
  createPublicHoliday,
  deletePublicHoliday,
  deleteShift,
  deleteTimesheet,
  editTimesheet,
  fetchEmployees,
  fetchPublicHolidays,
  fetchShifts,
  fetchTasks,
  fetchTimeOff,
  fetchTimesheets,
  fetchTimesheetTasks,
  publishShifts,
  rejectTimesheet,
  removeTimesheetWorkItem,
  updatePublicHoliday,
  updateShift,
} from '@/lib/api';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HIDDEN_KEY = 'cb-timesheets-hidden-employees';

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(date: Date) {
  return date.toISOString().split('T')[0];
}

function formatDuration(minutes?: number | null) {
  if (!minutes) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatMinsAsHours(mins?: number | null) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ''}`;
}

function formatTimeOnly(dateStr?: string | null) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Australia/Perth' });
  } catch { return '-'; }
}

function formatForInput(dateStr?: string | null) {
  if (!dateStr) return '';
  try {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Australia/Perth',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    return formatter.format(new Date(dateStr)).replace(' ', 'T').substring(0, 16);
  } catch { return ''; }
}

function formatWeekRange(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const s = start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  const e = end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  return sameYear ? `${s} — ${end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} ${end.getFullYear()}` : `${s} — ${e}`;
}

function getWorkSchedule(emp: Employee) {
  if (emp.work_schedule && typeof emp.work_schedule === 'object' && !Array.isArray(emp.work_schedule)) {
    return emp.work_schedule as Record<string, { enabled?: boolean; start?: string; end?: string }>;
  }
  return undefined;
}

function getExpectedMinsForDay(emp: Employee, dayIndex: number, weekStart: Date, holidays: PublicHoliday[]) {
  const dateStr = toISODate(addDays(weekStart, dayIndex));
  const holiday = holidays.find((h) => h.holiday_date === dateStr);
  if (holiday) return 0;
  const sched = getWorkSchedule(emp)?.[DAY_NAMES[dayIndex]];
  if (!sched?.enabled || !sched.start || !sched.end) return 0;
  const [sh, sm] = sched.start.split(':').map(Number);
  const [eh, em] = sched.end.split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(eh)) return 0;
  return (eh * 60 + em) - (sh * 60 + sm);
}

function getHoliday(dateStr: string, holidays: PublicHoliday[]) {
  return holidays.find((h) => h.holiday_date === dateStr);
}

function getTimeOff(employeeId: number, dateStr: string, requests: TimeOffRequest[]) {
  return requests.find((r) => r.employee_id === employeeId && dateStr >= r.start_date && dateStr <= r.end_date);
}

function getShiftStatusColor(status: string) {
  switch (status) {
    case 'scheduled': return 'bg-gray-400';
    case 'published': return 'bg-blue-500';
    case 'confirmed': return 'bg-green-500';
    case 'completed': return 'bg-emerald-500';
    case 'cancelled': return 'bg-red-500';
    default: return 'bg-gray-400';
  }
}

function getLeaveTypeLabel(type?: string | null) {
  const labels: Record<string, string> = { annual: 'Annual', sick: 'Sick', personal: 'Personal', unpaid: 'Unpaid', bereavement: 'Bereavement', other: 'Leave' };
  return labels[type || ''] || 'Leave';
}

function employeeDisplayName(emp?: Employee | null) {
  if (!emp) return 'Unknown';
  const user = emp.user as any;
  const full = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
  return full || user?.email || emp.name || `Employee ${emp.id}`;
}

function formatShortDate(date: Date) {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function getScheduleTime(emp: Employee, dayIndex: number) {
  const sched = getWorkSchedule(emp)?.[DAY_NAMES[dayIndex]];
  if (sched?.enabled && sched.start && sched.end) return `${sched.start.slice(0, 5)} – ${sched.end.slice(0, 5)}`;
  return '';
}

function statusDotClass(status: string) {
  switch (status) {
    case 'active': return 'bg-green-500';
    case 'completed': return 'bg-blue-500';
    case 'approved': return 'bg-emerald-500';
    case 'rejected': return 'bg-red-500';
    case 'edited': return 'bg-yellow-500';
    default: return 'bg-gray-400';
  }
}

function BreakTimer({ start }: { start: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((t) => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);
  const mins = Math.floor((Date.now() - new Date(start).getTime()) / 60000);
  return <span className="text-[10px] text-yellow-600 dark:text-yellow-400">({mins}m)</span>;
}

export default function AdminHrTimesheetsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [view, setView] = useState<'schedule' | 'list'>('schedule');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [listPage, setListPage] = useState(1);
  const listLimit = 20;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HIDDEN_KEY);
      if (stored) setHiddenIds(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  const persistHidden = (ids: Set<number>) => {
    setHiddenIds(ids);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(ids))); } catch { /* ignore */ }
  };

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)), [currentWeekStart]);
  const startDate = toISODate(currentWeekStart);
  const endDate = toISODate(weekDates[6]);
  const weekRangeText = formatWeekRange(currentWeekStart, weekDates[6]);

  const { data: entriesData, isLoading: loadingEntries } = useQuery({
    queryKey: ['timesheets', token, { start_date: startDate, end_date: endDate, limit: 500 }],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimesheets(token, { start_date: startDate, end_date: endDate, limit: 500 });
    },
    enabled: !!token,
  });

  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees', token, { status: 'active', limit: 200 }],
    queryFn: async () => {
      if (!token || !isManager) throw new Error('No token');
      return fetchEmployees(token, { status: 'active', limit: 200 });
    },
    enabled: !!token && isManager,
  });

  const { data: shiftsData, isLoading: loadingShifts } = useQuery({
    queryKey: ['shifts', token, { start_date: startDate, end_date: endDate, limit: 500 }],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchShifts(token, { start_date: startDate, end_date: endDate, limit: 500 });
    },
    enabled: !!token,
  });

  const { data: holidaysData, isLoading: loadingHolidays } = useQuery({
    queryKey: ['public-holidays', token, { start_date: startDate, end_date: endDate }],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchPublicHolidays(token, { start_date: startDate, end_date: endDate });
    },
    enabled: !!token,
  });

  const { data: timeOffData, isLoading: loadingTimeOff } = useQuery({
    queryKey: ['time-off', token, { status: 'approved', year: currentWeekStart.getFullYear(), limit: 200 }],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimeOff(token, { status: 'approved', year: currentWeekStart.getFullYear(), limit: 200 });
    },
    enabled: !!token,
  });

  const entries: TimeEntry[] = useMemo(() => entriesData?.data ?? [], [entriesData?.data]);
  const employees: Employee[] = useMemo(() => employeesData?.data ?? [], [employeesData?.data]);
  const shifts: Shift[] = useMemo(() => shiftsData?.data ?? [], [shiftsData?.data]);
  const holidays: PublicHoliday[] = useMemo(() => holidaysData?.data ?? [], [holidaysData?.data]);
  const timeOffRequests: TimeOffRequest[] = useMemo(() => timeOffData?.data ?? [], [timeOffData?.data]);
  const summary = useMemo(() => entriesData?.summary ?? { totalHours: 0, totalBreakHours: 0, entriesCount: 0, pendingApprovals: 0, totalEstimatedPay: 0 }, [entriesData?.summary]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['timesheets', token] });
    queryClient.invalidateQueries({ queryKey: ['shifts', token] });
    queryClient.invalidateQueries({ queryKey: ['public-holidays', token] });
    queryClient.invalidateQueries({ queryKey: ['time-off', token] });
  };

  const approve = useMutation({ mutationFn: (id: number) => approveTimesheet(token!, id), onSuccess: refresh });
  const reject = useMutation({ mutationFn: (id: number) => rejectTimesheet(token!, id, 'Rejected from UI'), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => deleteTimesheet(token!, id), onSuccess: refresh });
  const manual = useMutation({ mutationFn: (data: Record<string, unknown>) => createManualTimesheet(token!, data), onSuccess: refresh });
  const edit = useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => editTimesheet(token!, id, data), onSuccess: refresh });
  const signOut = useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => editTimesheet(token!, id, data), onSuccess: refresh });

  const updateShiftM = useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => updateShift(token!, id, data), onSuccess: refresh });
  const deleteShiftM = useMutation({ mutationFn: (id: number) => deleteShift(token!, id), onSuccess: refresh });
  const batchShiftsM = useMutation({ mutationFn: (data: Record<string, unknown>) => batchCreateShifts(token!, data), onSuccess: refresh });
  const publishM = useMutation({ mutationFn: (ids: number[]) => publishShifts(token!, ids), onSuccess: refresh });
  const copyWeekM = useMutation({ mutationFn: ({ source, target }: { source: string; target: string }) => copyShiftsWeek(token!, source, target), onSuccess: refresh });

  const saveHolidayM = useMutation({ mutationFn: ({ id, data }: { id?: number; data: Partial<PublicHoliday> }) => saveHoliday(token!, id, data), onSuccess: refresh });
  const deleteHolidayM = useMutation({ mutationFn: (id: number) => deletePublicHoliday(token!, id), onSuccess: refresh });

  async function saveHoliday(token: string, id: number | undefined, data: Partial<PublicHoliday>) {
    if (id) return updatePublicHoliday(token, id, data);
    return createPublicHoliday(token, data);
  }

  // Modals
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ employee_id: '', date: '', clock_in_time: '09:00', clock_out_time: '17:00', break_minutes: '0', reason: '' });

  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState({ id: '' as number | '', employee_id: '', shift_date: '', start_time: '09:00', end_time: '17:00', shift_type: 'regular', location: '', color: '#3B82F6', notes: '' });

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ employee_id: '', start_time: '09:00', end_time: '17:00', location: '', color: '#3B82F6', notes: '', selectedDays: [true, true, true, true, true, false, false] });

  const [holidayOpen, setHolidayOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState<{ id?: number; name: string; holiday_date: string; location: string }>({ name: '', holiday_date: '', location: '' });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: 0, clock_in_time: '', clock_out_time: '', break_minutes: '0', reason: '' });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<TimeEntry | null>(null);
  const [detailTasks, setDetailTasks] = useState<any[]>([]);
  const [detailWorkItems, setDetailWorkItems] = useState<any[]>([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskResults, setTaskResults] = useState<ProjectTask[]>([]);
  const [searchingTasks, setSearchingTasks] = useState(false);

  const statusColor: Record<string, string> = {
    active: 'default',
    completed: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    edited: 'outline',
  };

  const scheduleRows = useMemo(() => {
    const map = new Map<number, { employee: Employee; days: Record<string, any>; totalMinutes: number; totalBreak: number; expectedMinutes: number }>();
    employees.filter((e) => !hiddenIds.has(e.id)).forEach((emp) => {
      const days: Record<string, any> = {};
      weekDates.forEach((d, i) => {
        const dateStr = toISODate(d);
        days[dateStr] = { entries: [], shifts: [], timeOff: getTimeOff(emp.id, dateStr, timeOffRequests), holiday: getHoliday(dateStr, holidays), expectedMinutes: getExpectedMinsForDay(emp, i, currentWeekStart, holidays), totalMinutes: 0, onBreak: false };
      });
      const expectedMinutes = weekDates.reduce((sum, d, i) => sum + getExpectedMinsForDay(emp, i, currentWeekStart, holidays), 0);
      map.set(emp.id, { employee: emp, days, totalMinutes: 0, totalBreak: 0, expectedMinutes });
    });

    entries.forEach((entry) => {
      const dateStr = entry.clock_in_time ? entry.clock_in_time.split('T')[0] : '';
      if (!dateStr) return;
      let row = map.get(entry.employee_id);
      if (!row) {
        const days: Record<string, any> = {};
        weekDates.forEach((d) => {
          const ds = toISODate(d);
          days[ds] = { entries: [], shifts: [], timeOff: undefined, holiday: getHoliday(ds, holidays), expectedMinutes: 0, totalMinutes: 0, onBreak: false };
        });
        row = { employee: { id: entry.employee_id, user_id: 0, name: entry.employee?.name || entry.employee?.email || `Employee ${entry.employee_id}` } as Employee, days, totalMinutes: 0, totalBreak: 0, expectedMinutes: 0 };
        map.set(entry.employee_id, row);
      }
      if (row.days[dateStr]) {
        row.days[dateStr].entries.push(entry);
        row.days[dateStr].totalMinutes += entry.total_minutes || 0;
        row.days[dateStr].onBreak = !!entry.is_on_break;
        row.totalMinutes += entry.total_minutes || 0;
        row.totalBreak += entry.break_minutes || 0;
      }
    });

    // leave credits expected minutes
    map.forEach((row) => {
      weekDates.forEach((d) => {
        const ds = toISODate(d);
        if (row.days[ds].timeOff) row.totalMinutes += row.days[ds].expectedMinutes;
      });
    });

    // add shifts
    shifts.forEach((shift) => {
      const ds = shift.shift_date;
      const row = Array.from(map.values()).find((r) => r.employee.id === shift.employee_id);
      if (row && row.days[ds]) row.days[ds].shifts.push(shift);
    });

    return Array.from(map.values()).filter((r) => {
      if (hiddenIds.has(r.employee.id)) return false;
      const hasEntries = entries.some((e) => e.employee_id === r.employee.id);
      return hasEntries || r.expectedMinutes > 0;
    });
  }, [entries, employees, shifts, holidays, timeOffRequests, weekDates, hiddenIds, currentWeekStart]);

  const filteredListEntries = useMemo(() => {
    let rows = entries;
    if (statusFilter) rows = rows.filter((e) => e.status === statusFilter);
    if (employeeFilter) rows = rows.filter((e) => String(e.employee_id) === employeeFilter);
    rows = [...rows].sort((a, b) => new Date(b.clock_in_time).getTime() - new Date(a.clock_in_time).getTime());
    return rows;
  }, [entries, statusFilter, employeeFilter]);

  const listPages = Math.max(1, Math.ceil(filteredListEntries.length / listLimit));
  const pagedList = filteredListEntries.slice((listPage - 1) * listLimit, listPage * listLimit);

  useEffect(() => { setListPage(1); }, [statusFilter, employeeFilter, currentWeekStart]);

  const scheduleTotalMins = scheduleRows.reduce((s, r) => s + r.totalMinutes, 0);
  const scheduleExpectedMins = scheduleRows.reduce((s, r) => s + r.expectedMinutes, 0);
  const scheduleBreakMins = scheduleRows.reduce((s, r) => s + r.totalBreak, 0);
  const scheduleTotalHours = scheduleTotalMins / 60;
  const scheduleExpectedHours = scheduleExpectedMins / 60;
  const scheduleDiffHours = scheduleTotalHours - scheduleExpectedHours;

  const statCards = [
    { label: 'Total Hours', value: scheduleTotalHours.toFixed(1), icon: Clock, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
    { label: 'Expected Hours', value: scheduleExpectedHours.toFixed(1), icon: Calendar, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' },
    { label: 'Difference', value: `${scheduleDiffHours >= 0 ? '+' : ''}${scheduleDiffHours.toFixed(1)}h`, icon: scheduleDiffHours >= 0 ? CheckCircle : XCircle, color: scheduleDiffHours >= 0 ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300' },
    { label: 'Total Breaks', value: formatMinsAsHours(scheduleBreakMins), icon: Coffee, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' },
    { label: 'Pending Approvals', value: summary.pendingApprovals ?? 0, icon: FileClock, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300' },
    ...(isManager ? [{ label: 'Est. Pay', value: `$${Number(summary.totalEstimatedPay || 0).toFixed(2)}`, icon: DollarSign, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' }] : []),
  ];

  // Handlers
  const handlePrevWeek = () => setCurrentWeekStart((d) => addDays(d, -7));
  const handleNextWeek = () => setCurrentWeekStart((d) => addDays(d, 7));
  const handleThisWeek = () => setCurrentWeekStart(startOfWeek(new Date()));

  const handleManualSubmit = () => {
    if (!manualForm.employee_id || !manualForm.date || !manualForm.reason.trim()) { toast.error('Fill required fields'); return; }
    if (manualForm.date > toISODate(new Date())) { toast.error('Cannot add future dates'); return; }
    const payload: Record<string, unknown> = {
      employee_id: Number(manualForm.employee_id),
      clock_in_time: `${manualForm.date}T${manualForm.clock_in_time}:00+08:00`,
      break_minutes: Number(manualForm.break_minutes || 0),
      reason: manualForm.reason,
    };
    if (manualForm.clock_out_time) payload.clock_out_time = `${manualForm.date}T${manualForm.clock_out_time}:00+08:00`;
    manual.mutate(payload, { onSuccess: () => { setManualOpen(false); setManualForm({ employee_id: '', date: '', clock_in_time: '09:00', clock_out_time: '17:00', break_minutes: '0', reason: '' }); } });
  };

  const handleShiftSubmit = () => {
    if (!shiftForm.employee_id || !shiftForm.shift_date) { toast.error('Fill required fields'); return; }
    const payload = {
      employee_id: Number(shiftForm.employee_id),
      dates: [shiftForm.shift_date],
      start_time: shiftForm.start_time,
      end_time: shiftForm.end_time,
      shift_type: shiftForm.shift_type,
      location: shiftForm.location || undefined,
      color: shiftForm.color,
      notes: shiftForm.notes || undefined,
    };
    if (shiftForm.id) {
      updateShiftM.mutate({ id: Number(shiftForm.id), data: { ...payload, dates: undefined, shift_date: shiftForm.shift_date } as any }, { onSuccess: () => setShiftOpen(false) });
    } else {
      batchShiftsM.mutate(payload, { onSuccess: () => setShiftOpen(false) });
    }
  };

  const handleAddToScheduleSubmit = () => {
    if (!scheduleForm.employee_id) { toast.error('Select an employee'); return; }
    const dates = weekDates.filter((_, i) => scheduleForm.selectedDays[i]).map((d) => toISODate(d));
    if (dates.length === 0) { toast.error('Select at least one day'); return; }
    batchShiftsM.mutate({
      employee_id: Number(scheduleForm.employee_id),
      dates,
      start_time: scheduleForm.start_time,
      end_time: scheduleForm.end_time,
      location: scheduleForm.location || undefined,
      color: scheduleForm.color,
      notes: scheduleForm.notes || undefined,
    }, { onSuccess: () => { setScheduleOpen(false); persistHidden(new Set(Array.from(hiddenIds).filter((id) => id !== Number(scheduleForm.employee_id)))); } });
  };

  const handleHolidaySubmit = () => {
    if (!holidayForm.name || !holidayForm.holiday_date) { toast.error('Fill required fields'); return; }
    saveHolidayM.mutate({ id: holidayForm.id, data: { name: holidayForm.name, holiday_date: holidayForm.holiday_date, location: holidayForm.location || undefined } }, { onSuccess: () => setHolidayOpen(false) });
  };

  const handleEditSubmit = () => {
    if (!editForm.reason.trim()) { toast.error('Provide a reason for the edit'); return; }
    const payload: Record<string, unknown> = { reason: editForm.reason, break_minutes: Number(editForm.break_minutes || 0) };
    if (editForm.clock_in_time) payload.clock_in_time = `${editForm.clock_in_time}:00+08:00`;
    if (editForm.clock_out_time) payload.clock_out_time = `${editForm.clock_out_time}:00+08:00`;
    edit.mutate({ id: editForm.id, data: payload }, { onSuccess: () => setEditOpen(false) });
  };

  const openEdit = (entry: TimeEntry) => {
    setEditForm({ id: entry.id, clock_in_time: formatForInput(entry.clock_in_time), clock_out_time: formatForInput(entry.clock_out_time), break_minutes: String(entry.break_minutes || 0), reason: '' });
    setEditOpen(true);
  };

  const openDetail = async (entry: TimeEntry) => {
    setDetailEntry(entry);
    setDetailOpen(true);
    setTaskSearch('');
    setTaskResults([]);
    try {
      const res = await fetchTimesheetTasks(token!, entry.id);
      if (res.success) {
        setDetailTasks(res.data || []);
        setDetailWorkItems(res.workItems || []);
      }
    } catch { /* ignore */ }
  };

  const handleTaskSearch = async (q: string) => {
    setTaskSearch(q);
    if (q.length < 2) { setTaskResults([]); return; }
    setSearchingTasks(true);
    try {
      const res = await fetchTasks(token!, { search: q, limit: 10 });
      setTaskResults(res.data || []);
    } catch { setTaskResults([]); } finally { setSearchingTasks(false); }
  };

  const handleAddTask = (task: ProjectTask, hours?: string) => {
    const actual = hours ? Number(hours) : undefined;
    if (Number.isNaN(actual)) return;
    addTimesheetWorkItem(token!, detailEntry!.id, { task_id: task.id, hours_spent: actual }).then(() => openDetail(detailEntry!));
  };

  const handleQuickSignIn = (employeeId: number) => {
    manual.mutate({ employee_id: employeeId, clock_in_time: new Date().toISOString(), break_minutes: 0, reason: 'Admin Quick Sign In' }, { onSuccess: () => toast.success('Signed in') });
  };

  const handleQuickSignOut = (entry: TimeEntry) => {
    signOut.mutate({ id: entry.id, data: { clock_out_time: new Date().toISOString(), break_minutes: entry.break_minutes || 0, reason: 'Admin Quick Sign Out' } }, { onSuccess: () => toast.success('Signed out') });
  };

  const handlePublish = () => {
    const ids = shifts.filter((s) => s.status === 'scheduled').map((s) => s.id);
    if (!ids.length) { toast.error('No unpublished shifts'); return; }
    publishM.mutate(ids, { onSuccess: () => toast.success('Shifts published') });
  };

  const handleCopyWeek = () => {
    const target = addDays(currentWeekStart, 7);
    if (!window.confirm(`Copy this week's shifts to ${toISODate(target)}?`)) return;
    copyWeekM.mutate({ source: startDate, target: toISODate(target) }, { onSuccess: () => { toast.success('Week copied'); setCurrentWeekStart(target); } });
  };

  const handleExportCSV = () => {
    if (!filteredListEntries.length) { toast.error('No data to export'); return; }
    const headers = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Break (mins)', 'Total Hours', 'Status'];
    const rows = filteredListEntries.map((entry) => {
      const name = entry.employee?.name || entry.employee?.email || `Employee ${entry.employee_id}`;
      const date = entry.clock_in_time ? new Date(entry.clock_in_time).toLocaleDateString('en-AU') : '';
      return [name, date, formatTimeOnly(entry.clock_in_time), formatTimeOnly(entry.clock_out_time), entry.break_minutes || 0, ((entry.total_minutes || 0) / 60).toFixed(2), entry.status].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheets_${startDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openShiftModal = (empId?: number, date?: string, shift?: Shift) => {
    if (shift) {
      setShiftForm({ id: shift.id, employee_id: String(shift.employee_id), shift_date: shift.shift_date, start_time: shift.start_time.slice(0, 5), end_time: shift.end_time.slice(0, 5), shift_type: shift.shift_type || 'regular', location: shift.location || '', color: shift.color || '#3B82F6', notes: shift.notes || '' });
    } else {
      setShiftForm({ id: '', employee_id: empId ? String(empId) : '', shift_date: date || '', start_time: '09:00', end_time: '17:00', shift_type: 'regular', location: '', color: '#3B82F6', notes: '' });
    }
    setShiftOpen(true);
  };

  const openHolidayModal = (holiday?: PublicHoliday) => {
    if (holiday) setHolidayForm({ id: holiday.id, name: holiday.name, holiday_date: holiday.holiday_date, location: holiday.location || '' });
    else setHolidayForm({ name: '', holiday_date: startDate, location: '' });
    setHolidayOpen(true);
  };

  const allLoading = loadingEntries || loadingEmployees || loadingShifts || loadingHolidays || loadingTimeOff;

  return (
    <PageShell
      title="Timesheets"
      icon={FileClock}
      description={`${weekRangeText} · Review, approve, and manage employee time entries.`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={handleThisWeek}>This Week</Button>
          <Button variant="outline" onClick={handleNextWeek}><ChevronRight className="h-4 w-4" /></Button>
          {isManager && (
            <>
              <Button variant="outline" onClick={handlePublish} disabled={publishM.isPending}><Send className="mr-1 h-4 w-4" /> Publish</Button>
              <Button variant="outline" onClick={handleCopyWeek} disabled={copyWeekM.isPending}><Copy className="mr-1 h-4 w-4" /> Copy Week</Button>
              <Button variant="outline" onClick={handleExportCSV}><Download className="mr-1 h-4 w-4" /> CSV</Button>
              <Button onClick={() => setManualOpen(true)}><Plus className="mr-1 h-4 w-4" /> Manual Entry</Button>
            </>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="nm-raised p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-xl font-bold">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as 'schedule' | 'list')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
            {isManager && (
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>{employeeDisplayName(emp)}</option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="edited">Edited</option>
            </select>
            {isManager && <Button variant="outline" onClick={() => setScheduleOpen(true)}><Plus className="mr-1 h-4 w-4" /> Add to Schedule</Button>}
            <Button variant="outline" onClick={() => openHolidayModal()}><Gift className="mr-1 h-4 w-4" /> Holiday</Button>
          </div>
        </div>

        <TabsContent value="schedule" className="mt-4">
          <Card className="nm-raised">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle>Weekly Schedule</CardTitle>
              {hiddenIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Hidden employees:</span>
                  {employees.filter((e) => hiddenIds.has(e.id)).map((e) => (
                    <Badge key={e.id} variant="outline" className="cursor-pointer" onClick={() => { const next = new Set(hiddenIds); next.delete(e.id); persistHidden(next); }}>
                      {employeeDisplayName(e)} <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {allLoading && scheduleRows.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : scheduleRows.length === 0 ? (
                <div className="text-center py-16">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
                  <p className="text-lg font-medium">No timesheet data this week</p>
                  <p className="text-sm text-muted-foreground mt-1">Employees will appear here once they clock in.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {allLoading && (
                    <div className="absolute right-4 top-4 z-20 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-primary shadow">
                      Updating week...
                    </div>
                  )}
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-52 sticky left-0 bg-background z-10">Employee</th>
                        {weekDates.map((d, i) => {
                          const isToday = toISODate(d) === toISODate(new Date());
                          return (
                            <th key={i} className={`px-2 py-3 text-center text-sm font-medium min-w-[120px] ${isToday ? 'bg-teal-50/30 dark:bg-teal-900/10' : ''}`}>
                              <div className={isToday ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-muted-foreground'}>{DAY_LABELS[i]}</div>
                              <div className="text-[10px] text-muted-foreground">{formatShortDate(d)}</div>
                            </th>
                          );
                        })}
                        <th className="px-3 py-3 text-center text-sm font-medium text-muted-foreground w-24">Total</th>
                        <th className="px-3 py-3 text-center text-sm font-medium text-muted-foreground w-24">Expected</th>
                        <th className="px-3 py-3 text-center text-sm font-medium text-muted-foreground w-24">Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {scheduleRows.map((row) => {
                        const activeEntry = entries.find((e: TimeEntry) => e.employee_id === row.employee.id && !e.clock_out_time);
                        const diffMins = row.totalMinutes - row.expectedMinutes;
                        const empUser = (row.employee as any)?.user;
                        const empName = employeeDisplayName(row.employee);
                        return (
                          <tr key={row.employee.id} className="hover:bg-primary/[0.03] transition-colors">
                            <td className="px-4 py-3 sticky left-0 bg-background z-10 align-top">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  {empUser?.avatar ? (
                                    <img src={empUser.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                      <User className="w-4 h-4 text-primary" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate max-w-[140px]">{empName}</p>
                                    {row.totalBreak > 0 && <p className="text-[10px] text-muted-foreground">Break {formatMinsAsHours(row.totalBreak)}</p>}
                                  </div>
                                </div>
                                {isManager && (
                                  <div className="flex flex-wrap gap-1">
                                    {activeEntry ? (
                                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => handleQuickSignOut(activeEntry)}>
                                        <Square className="h-3 w-3 mr-1" /> Sign Out
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600" onClick={() => handleQuickSignIn(row.employee.id)}>
                                        <Play className="h-3 w-3 mr-1" /> Sign In
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => { const next = new Set(hiddenIds); next.add(row.employee.id); persistHidden(next); }}>
                                      <UserMinus className="h-3 w-3 mr-1" /> Hide
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </td>
                            {weekDates.map((d, i) => {
                              const ds = toISODate(d);
                              const cell = row.days[ds];
                              const isToday = ds === toISODate(new Date());
                              const todayMid = new Date(new Date().setHours(0, 0, 0, 0));
                              const isPast = d.getTime() < todayMid.getTime() && !isToday;
                              const isFuture = d.getTime() > todayMid.getTime() && !isToday;
                              const scheduleStr = getScheduleTime(row.employee, i);
                              const active = cell.entries.find((e: TimeEntry) => !e.clock_out_time);
                              const hasGps = (entry: TimeEntry) => {
                                if (entry.gps_coordinates) {
                                  try { return JSON.parse(entry.gps_coordinates).length > 0; } catch { return false; }
                                }
                                return !!entry.clock_in_address || !!entry.clock_out_address;
                              };
                              return (
                                <td key={ds} className={`p-1 align-top min-w-[120px] ${isToday ? 'bg-teal-50/20 dark:bg-teal-900/5' : ''}`}>
                                  <div className="min-h-[90px] rounded-lg nm-inset-sm p-1.5 space-y-1">
                                    {cell.holiday && (
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/20 text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                                        <Gift className="h-2.5 w-2.5" /> {cell.holiday.name}
                                      </div>
                                    )}
                                    {cell.timeOff && (
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 text-[10px] text-orange-700 dark:text-orange-300">
                                        <Umbrella className="h-2.5 w-2.5" /> {getLeaveTypeLabel(cell.timeOff.leave_type)}
                                      </div>
                                    )}
                                    {cell.shifts.map((s: Shift) => (
                                      <button key={s.id} onClick={() => openShiftModal(undefined, undefined, s)} className="block w-full text-left">
                                        <div className="text-xs px-1.5 py-1 rounded text-white" style={{ backgroundColor: s.color || '#3B82F6', borderLeft: `3px solid ${s.color || '#3B82F6'}` }}>
                                          <div className="font-medium">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</div>
                                          {s.location && <div className="text-[9px] opacity-90 truncate">{s.location}</div>}
                                          <div className="text-[9px] opacity-80 capitalize">{s.status}</div>
                                        </div>
                                      </button>
                                    ))}
                                    {cell.entries.map((entry: TimeEntry) => {
                                      const onBreak = entry.is_on_break && !entry.clock_out_time;
                                      return (
                                        <div key={entry.id} className="group p-1.5 rounded-lg text-xs nm-inset-sm border border-transparent hover:border-primary/20 cursor-pointer transition-all" onClick={() => openDetail(entry)}>
                                          <div className="flex items-center gap-1 mb-0.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(entry.status)}`}></span>
                                            <span className="font-medium">{formatTimeOnly(entry.clock_in_time)}</span>
                                          </div>
                                          {entry.clock_out_time ? (
                                            <div className="text-muted-foreground">→ {formatTimeOnly(entry.clock_out_time)}</div>
                                          ) : onBreak ? (
                                            <div className="text-yellow-600 dark:text-yellow-400 font-medium flex items-center gap-1">
                                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                                              On Break
                                              {entry.break_start_time && <BreakTimer start={entry.break_start_time} />}
                                            </div>
                                          ) : (
                                            <div className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                              Active
                                            </div>
                                          )}
                                          {entry.total_minutes ? (
                                            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                              {formatMinsAsHours(entry.total_minutes)}
                                              {entry.break_minutes ? <span className="text-purple-400"> | {entry.break_minutes}m brk</span> : null}
                                              {hasGps(entry) && <MapPin className="h-2.5 w-2.5 text-primary flex-shrink-0" />}
                                            </div>
                                          ) : null}
                                          {entry.clock_out_time && (entry.work_items_count === 0 || entry.work_items_count === undefined) && entry.status !== 'active' && (
                                            <div className="flex items-center gap-0.5 mt-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1 py-0.5 rounded">
                                              No Tasks
                                            </div>
                                          )}
                                          {isManager && (entry.status === 'completed' || entry.status === 'edited') && !entry.approved_by && (
                                            <div className="hidden group-hover:flex items-center gap-1 mt-1 pt-1 border-t border-border/50">
                                              <button onClick={(e) => { e.stopPropagation(); approve.mutate(entry.id); }} className="flex-1 text-center py-0.5 bg-emerald-500 text-white rounded text-[10px] hover:brightness-110">
                                                <CheckCircle className="h-3 w-3 mx-auto" />
                                              </button>
                                              <button onClick={(e) => { e.stopPropagation(); reject.mutate(entry.id); }} className="flex-1 text-center py-0.5 bg-red-500 text-white rounded text-[10px] hover:brightness-110">
                                                <XCircle className="h-3 w-3 mx-auto" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {cell.entries.length === 0 && cell.shifts.length === 0 && !cell.timeOff && !cell.holiday && (
                                      <>
                                        {scheduleStr && (isPast) ? (
                                          <div className="p-1.5 rounded-lg text-xs nm-inset-sm border border-amber-500/30 cursor-pointer hover:shadow-md transition-all" onClick={() => { setManualForm({ employee_id: String(row.employee.id), date: ds, clock_in_time: '09:00', clock_out_time: '17:00', break_minutes: '0', reason: '' }); setManualOpen(true); }}>
                                            <div className="text-amber-600 dark:text-amber-400 text-[10px] font-medium">No entry</div>
                                            <div className="text-amber-400 dark:text-amber-500 text-[10px]">{scheduleStr}</div>
                                            {isManager && <div className="text-amber-600 dark:text-amber-300 text-[10px] mt-0.5">+ Add hours</div>}
                                          </div>
                                        ) : scheduleStr && (isFuture || isToday) ? (
                                          <div className="p-1.5 rounded-lg text-xs border border-dashed border-border nm-inset-sm cursor-pointer hover:shadow-md transition-all" onClick={() => openShiftModal(row.employee.id, ds)}>
                                            <div className="text-muted-foreground text-[10px]">{scheduleStr}</div>
                                            {isManager && <div className="text-muted-foreground text-[10px]">Default · click to create</div>}
                                          </div>
                                        ) : null}
                                      </>
                                    )}
                                    {isManager && (isFuture || isToday) && (
                                      <button onClick={() => openShiftModal(row.employee.id, ds)} className="w-full p-1 text-center text-muted-foreground hover:text-primary opacity-0 hover:opacity-100 transition-all">
                                        <Plus className="h-3 w-3 mx-auto" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-3 py-3 text-center align-middle">
                              <span className="text-sm font-bold">{formatMinsAsHours(row.totalMinutes)}</span>
                            </td>
                            <td className="px-3 py-3 text-center align-middle">
                              <span className="text-sm text-muted-foreground">{formatMinsAsHours(row.expectedMinutes)}</span>
                            </td>
                            <td className="px-3 py-3 text-center align-middle">
                              {row.expectedMinutes > 0 ? (
                                <span className={`text-sm font-medium ${diffMins >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {diffMins >= 0 ? '+' : ''}{formatMinsAsHours(Math.abs(diffMins))}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card className="nm-raised">
            <CardHeader>
              <CardTitle>Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEntries && <div className="text-muted-foreground">Loading...</div>}
              {!loadingEntries && (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedList.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">No entries found.</TableCell>
                        </TableRow>
                      )}
                      {pagedList.map((entry) => (
                        <TableRow key={entry.id} className="cursor-pointer hover:bg-primary/5" onClick={() => openDetail(entry)}>
                          <TableCell>{entry.employee?.name || entry.employee?.email || `Employee ${entry.employee_id}`}</TableCell>
                          <TableCell>{entry.clock_in_time ? new Date(entry.clock_in_time).toLocaleDateString('en-AU') : '-'}</TableCell>
                          <TableCell>{formatTimeOnly(entry.clock_in_time)}</TableCell>
                          <TableCell>{formatTimeOnly(entry.clock_out_time)}</TableCell>
                          <TableCell>{formatDuration(entry.total_minutes)}</TableCell>
                          <TableCell><Badge variant={(statusColor[entry.status] as any) || 'secondary'}>{entry.status}</Badge></TableCell>
                          <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" onClick={() => openDetail(entry)}><Eye className="h-4 w-4" /></Button>
                            {entry.status !== 'approved' && entry.clock_out_time && (
                              <Button size="sm" variant="ghost" onClick={() => approve.mutate(entry.id)} disabled={approve.isPending}><CheckCircle className="h-4 w-4" /></Button>
                            )}
                            {entry.status !== 'rejected' && (
                              <Button size="sm" variant="ghost" onClick={() => reject.mutate(entry.id)} disabled={reject.isPending}><XCircle className="h-4 w-4" /></Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openEdit(entry)}><Edit className="h-4 w-4" /></Button>
                            {!entry.clock_out_time && <Button size="sm" variant="ghost" onClick={() => handleQuickSignOut(entry)}><Square className="h-4 w-4" /></Button>}
                            {isManager && <Button size="sm" variant="ghost" onClick={() => remove.mutate(entry.id)} disabled={remove.isPending}><Trash2 className="h-4 w-4" /></Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Pagination
                    currentPage={listPage}
                    totalPages={listPages}
                    totalItems={filteredListEntries.length}
                    onPageChange={setListPage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manual Entry Modal */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manual Timesheet Entry</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Employee</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={manualForm.employee_id} onChange={(e) => setManualForm({ ...manualForm, employee_id: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map((emp) => <option key={emp.id} value={String(emp.id)}>{employeeDisplayName(emp)}</option>)}
              </select>
            </div>
            <div><Label>Date</Label><Input type="date" value={manualForm.date} onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Clock In</Label><Input type="time" value={manualForm.clock_in_time} onChange={(e) => setManualForm({ ...manualForm, clock_in_time: e.target.value })} /></div>
              <div><Label>Clock Out</Label><Input type="time" value={manualForm.clock_out_time} onChange={(e) => setManualForm({ ...manualForm, clock_out_time: e.target.value })} /></div>
            </div>
            <div><Label>Break (minutes)</Label><Input type="number" value={manualForm.break_minutes} onChange={(e) => setManualForm({ ...manualForm, break_minutes: e.target.value })} /></div>
            <div><Label>Reason</Label><Textarea value={manualForm.reason} onChange={(e) => setManualForm({ ...manualForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleManualSubmit} disabled={manual.isPending}>Save Entry</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Modal */}
      <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{shiftForm.id ? 'Edit Shift' : 'Add Shift'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Employee</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={shiftForm.employee_id} onChange={(e) => setShiftForm({ ...shiftForm, employee_id: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map((emp) => <option key={emp.id} value={String(emp.id)}>{employeeDisplayName(emp)}</option>)}
              </select>
            </div>
            <div><Label>Date</Label><Input type="date" value={shiftForm.shift_date} onChange={(e) => setShiftForm({ ...shiftForm, shift_date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start</Label><Input type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })} /></div>
              <div><Label>End</Label><Input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })} /></div>
            </div>
            <div><Label>Type</Label><Input value={shiftForm.shift_type} onChange={(e) => setShiftForm({ ...shiftForm, shift_type: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={shiftForm.location} onChange={(e) => setShiftForm({ ...shiftForm, location: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Color</Label><Input type="color" value={shiftForm.color} onChange={(e) => setShiftForm({ ...shiftForm, color: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={shiftForm.notes} onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            {shiftForm.id && <Button variant="destructive" onClick={() => { deleteShiftM.mutate(Number(shiftForm.id), { onSuccess: () => setShiftOpen(false) }); }}>Delete</Button>}
            <Button onClick={handleShiftSubmit} disabled={updateShiftM.isPending || batchShiftsM.isPending}>Save Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Schedule Modal */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add to Schedule</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Employee</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={scheduleForm.employee_id} onChange={(e) => setScheduleForm({ ...scheduleForm, employee_id: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map((emp) => <option key={emp.id} value={String(emp.id)}>{employeeDisplayName(emp)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start</Label><Input type="time" value={scheduleForm.start_time} onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })} /></div>
              <div><Label>End</Label><Input type="time" value={scheduleForm.end_time} onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })} /></div>
            </div>
            <div><Label>Location</Label><Input value={scheduleForm.location} onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })} /></div>
            <div><Label>Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={scheduleForm.selectedDays[i]} onChange={(e) => { const next = [...scheduleForm.selectedDays]; next[i] = e.target.checked; setScheduleForm({ ...scheduleForm, selectedDays: next }); }} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div><Label>Notes</Label><Textarea value={scheduleForm.notes} onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddToScheduleSubmit} disabled={batchShiftsM.isPending}>Add Shifts</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Holiday Modal */}
      <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{holidayForm.id ? 'Edit Holiday' : 'Add Public Holiday'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name</Label><Input value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} /></div>
            <div><Label>Date</Label><Input type="date" value={holidayForm.holiday_date} onChange={(e) => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={holidayForm.location} onChange={(e) => setHolidayForm({ ...holidayForm, location: e.target.value })} placeholder="Australia / Both / Global" /></div>
          </div>
          <DialogFooter>
            {holidayForm.id && <Button variant="destructive" onClick={() => { deleteHolidayM.mutate(holidayForm.id!, { onSuccess: () => setHolidayOpen(false) }); }}>Delete</Button>}
            <Button onClick={handleHolidaySubmit} disabled={saveHolidayM.isPending}>Save Holiday</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Entry</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Clock In</Label><Input type="datetime-local" value={editForm.clock_in_time} onChange={(e) => setEditForm({ ...editForm, clock_in_time: e.target.value })} /></div>
            <div><Label>Clock Out</Label><Input type="datetime-local" value={editForm.clock_out_time} onChange={(e) => setEditForm({ ...editForm, clock_out_time: e.target.value })} /></div>
            <div><Label>Break (minutes)</Label><Input type="number" value={editForm.break_minutes} onChange={(e) => setEditForm({ ...editForm, break_minutes: e.target.value })} /></div>
            <div><Label>Reason</Label><Textarea value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleEditSubmit} disabled={edit.isPending}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Entry Detail</DialogTitle></DialogHeader>
          {detailEntry && (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant={(statusColor[detailEntry.status] as any) || 'secondary'}>{detailEntry.status}</Badge>
                {detailEntry.is_on_break && <Badge variant="outline">On Break</Badge>}
                {detailEntry.clock_in_address && <Badge variant="outline"><MapPin className="mr-1 h-3 w-3" />{detailEntry.clock_in_address}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Clock In:</span> {new Date(detailEntry.clock_in_time).toLocaleString('en-AU', { timeZone: 'Australia/Perth' })}</div>
                <div><span className="text-muted-foreground">Clock Out:</span> {detailEntry.clock_out_time ? new Date(detailEntry.clock_out_time).toLocaleString('en-AU', { timeZone: 'Australia/Perth' }) : '—'}</div>
                <div><span className="text-muted-foreground">Duration:</span> {formatDuration(detailEntry.total_minutes)}</div>
                <div><span className="text-muted-foreground">Break:</span> {formatDuration(detailEntry.break_minutes)}</div>
              </div>
              {detailEntry.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {detailEntry.notes}</div>}

              <div>
                <h4 className="font-medium mb-2">Work Items</h4>
                {detailWorkItems.length === 0 ? <p className="text-sm text-muted-foreground">No work items linked.</p> : (
                  <div className="space-y-1">
                    {detailWorkItems.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                        <span>{item.task?.title || `Task ${item.task_id}`} {item.actual_hours != null && `(${item.actual_hours}h)`}</span>
                        <Button size="sm" variant="ghost" onClick={() => removeTimesheetWorkItem(token!, detailEntry.id, item.id).then(() => openDetail(detailEntry))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-2">Add Task</h4>
                <div className="relative">
                  <Input placeholder="Search tasks..." value={taskSearch} onChange={(e) => handleTaskSearch(e.target.value)} />
                  {searchingTasks && <span className="absolute right-2 top-2 text-xs text-muted-foreground">Searching...</span>}
                </div>
                {taskResults.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                    {taskResults.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-2 text-sm hover:bg-muted">
                        <span>{task.title}</span>
                        <div className="flex items-center gap-1">
                          <Input type="number" placeholder="hrs" className="w-16 h-8" id={`hrs-${task.id}`} />
                          <Button size="sm" onClick={() => handleAddTask(task, (document.getElementById(`hrs-${task.id}`) as HTMLInputElement)?.value)}>Add</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {detailEntry.status !== 'approved' && detailEntry.clock_out_time && <Button onClick={() => approve.mutate(detailEntry.id)}><CheckCircle className="mr-1 h-4 w-4" /> Approve</Button>}
                {detailEntry.status !== 'rejected' && <Button variant="outline" onClick={() => reject.mutate(detailEntry.id)}><XCircle className="mr-1 h-4 w-4" /> Reject</Button>}
                {!detailEntry.clock_out_time && <Button variant="outline" onClick={() => handleQuickSignOut(detailEntry)}><Square className="mr-1 h-4 w-4" /> Sign Out</Button>}
                <Button variant="outline" onClick={() => openEdit(detailEntry)}><Edit className="mr-1 h-4 w-4" /> Edit</Button>
                {isManager && <Button variant="destructive" onClick={() => { remove.mutate(detailEntry.id); setDetailOpen(false); }}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
