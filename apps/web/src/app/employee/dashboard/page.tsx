'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { fetchEmployeeDashboard, fetchPublicHolidays } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Calendar, Clock, ListTodo, Receipt, FileText, Sun, AlertCircle, Briefcase, Palmtree } from 'lucide-react';

export default function EmployeeDashboardPage() {
  const { token, user } = useAuth();

  const dashboardQuery = useQuery({
    queryKey: ['employee-dashboard', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const res = await fetchEmployeeDashboard(token);
      return res.data;
    },
    enabled: !!token,
  });

  const holidaysQuery = useQuery({
    queryKey: ['public-holidays', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchPublicHolidays(token);
    },
    enabled: !!token,
  });

  const data = dashboardQuery.data;
  const employee = data?.employee;
  const today = new Date().toISOString().split('T')[0];
  const upcomingHolidays = (holidaysQuery.data?.data ?? []).filter((h: any) => h.holiday_date >= today).slice(0, 3);

  const statCards = useMemo(
    () => [
      {
        label: 'Open Tasks',
        value: data?.stats?.openTasks ?? 0,
        icon: ListTodo,
        accent: 'primary' as const,
        to: '/employee/tasks',
      },
      {
        label: 'Pending Time Off',
        value: data?.stats?.pendingTimeOff ?? 0,
        icon: Palmtree,
        accent: 'warning' as const,
        to: '/employee/time-off',
      },
      {
        label: 'Annual Leave',
        value: `${data?.stats?.annualLeave ?? 0} days`,
        icon: Sun,
        accent: 'success' as const,
        to: '/employee/time-off',
      },
      {
        label: 'Payslips',
        value: data?.stats?.payslips ?? 0,
        icon: Receipt,
        accent: 'secondary' as const,
        to: '/employee/payslips',
      },
    ],
    [data],
  );

  if (dashboardQuery.isLoading) {
    return (
      <PageShell title="Dashboard" icon={Briefcase}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-2xl mt-6" />
      </PageShell>
    );
  }

  if (dashboardQuery.error || !employee) {
    return (
      <PageShell title="Dashboard" icon={Briefcase}>
        <div className="p-6 nm-raised rounded-xl text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Failed to load employee dashboard. Please contact HR if your profile is missing.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`Welcome, ${employee.name || user?.first_name || 'Employee'}`}
      icon={Briefcase}
      description={`${employee.position || 'Employee'}${employee.department ? ` · ${employee.department}` : ''}`}
      actions={
        <Button asChild variant="outline">
          <Link href="/employee/time-clock">
            <Clock className="mr-1 h-4 w-4" /> Time Clock
          </Link>
        </Button>
      }
    >
      <StatCards cards={statCards} />

      {data?.activeEntry && (
        <div className="nm-raised p-4 rounded-xl border-l-4 border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Clocked In</p>
              <p className="text-xs text-muted-foreground">Since {formatDate(data.activeEntry.clock_in_time)}</p>
            </div>
            <Button asChild size="sm">
              <Link href="/employee/time-clock">Go to Time Clock</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ListTodo className="h-4 w-4" /> Open Tasks
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/employee/tasks">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(data?.openTasks?.length ?? 0) > 0 ? (
              <ul className="divide-y">
                {data.openTasks.slice(0, 5).map((task: any) => (
                  <li key={task.id} className="py-3 first:pt-0 last:pb-0">
                    <Link href={`/employee/tasks/${task.id}`} className="block hover:underline">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.crm_projects?.name || 'No project'}</p>
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={task.status} />
                      <PriorityBadge priority={task.priority} />
                      {task.due_date && <span className="text-xs text-muted-foreground">Due {formatDate(task.due_date)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No open tasks.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Palmtree className="h-4 w-4" /> Leave Balances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Annual</span> <span>{data?.stats?.annualLeave ?? 0} days</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sick</span> <span>{data?.stats?.sickLeave ?? 0} days</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Personal</span> <span>{data?.stats?.personalLeave ?? 0} days</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sun className="h-4 w-4" /> Upcoming Public Holidays
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingHolidays.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {upcomingHolidays.map((h: any) => (
                    <li key={h.id} className="flex justify-between">
                      <span>{h.name}</span>
                      <span className="text-muted-foreground">{formatDate(h.holiday_date)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Upcoming Shifts
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/employee/time-clock">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(data?.upcomingShifts?.length ?? 0) > 0 ? (
              <ul className="space-y-2 text-sm">
                {data.upcomingShifts.slice(0, 5).map((shift: any) => (
                  <li key={shift.id} className="flex justify-between">
                    <span>{formatDate(shift.shift_date)}</span>
                    <span className="text-muted-foreground">{shift.start_time ? new Date(shift.start_time).toISOString().slice(11, 16) : '-'} - {shift.end_time ? new Date(shift.end_time).toISOString().slice(11, 16) : '-'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No upcoming shifts.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Recent Payslips
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/employee/payslips">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(data?.recentPayslips?.length ?? 0) > 0 ? (
              <ul className="space-y-2 text-sm">
                {data.recentPayslips.slice(0, 5).map((p: any) => (
                  <li key={p.id} className="flex justify-between items-center">
                    <span>{formatDate(p.pay_period_start)} - {formatDate(p.pay_period_end)}</span>
                    <span className="font-medium">{formatCurrency(Number(p.net_pay), p.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No payslips yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Recent Time Off
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/employee/time-off">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(data?.recentTimeOff?.length ?? 0) > 0 ? (
              <ul className="space-y-2 text-sm">
                {data.recentTimeOff.slice(0, 5).map((r: any) => (
                  <li key={r.id} className="flex justify-between items-center">
                    <span>{r.leave_type} ({formatDate(r.start_date)})</span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No time-off requests.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
