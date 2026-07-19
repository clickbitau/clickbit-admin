'use client';
import { PageShell } from '@/components/design-system/PageShell';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { useQueries } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { fetchHrDashboard, fetchHrStats } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { LayoutDashboard as LayoutDashboardIcon, Users, Briefcase, Calendar, Clock, CreditCard, Megaphone, Bell, Plane, ArrowRight } from 'lucide-react';

export default function AdminHrPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [dashboard, stats] = useQueries({
    queries: [
      {
        queryKey: ['hr-dashboard', token],
        queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrDashboard(token); },
        enabled: !!token,
      },
      {
        queryKey: ['hr-stats', token],
        queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
        enabled: !!token,
      },
    ],
  });

  const d = dashboard.data?.data;
  const s = stats.data?.data;

  const topCards = s ? [
    { label: 'Total Employees', value: s.employees.total, icon: Users, accent: 'primary' as const, link: '/admin/hr/employees' },
    { label: 'Active Contracts', value: s.contracts.active, icon: Briefcase, accent: 'success' as const, link: '/admin/hr/contracts' },
    { label: 'Pending Time Off', value: s.timeOff.pending, icon: Plane, accent: 'warning' as const, link: '/admin/hr/time-off' },
    { label: 'Clocked In', value: s.timeClock.active, icon: Clock, accent: 'success' as const, link: '/admin/hr/time-clock' },
    { label: 'Payslips to Pay', value: s.payslips.generated, icon: CreditCard, accent: 'warning' as const, link: '/admin/hr/payslips' },
    { label: 'Shifts Today', value: s.shifts.today, icon: Calendar, accent: 'primary' as const, link: '/admin/hr/shifts' },
    { label: 'Announcements', value: s.announcements.published, icon: Megaphone, accent: 'secondary' as const, link: '/admin/hr/announcements' },
    { label: 'Pending Reminders', value: s.reminders.pending, icon: Bell, accent: 'warning' as const, link: '/admin/hr/reminders' },
  ] : [];

  return (
    <PageShell
      title="HR Dashboard"
      icon={LayoutDashboardIcon}
      description="People, leave, time, pay and internal comms overview."
    >
      {dashboard.error || stats.error ? (
        <div className="text-destructive">Failed to load HR dashboard.</div>
      ) : (
        <>
          {stats.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <StatCards cards={topCards.map((c) => ({ label: c.label, value: c.value, icon: c.icon, accent: c.accent, onClick: () => router.push(c.link) }))} />
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <DashboardCard title="Employees" link="/admin/hr/employees" isLoading={stats.isLoading}>
              {s && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <SummaryItem label="Active" value={s.employees.active} />
                  <SummaryItem label="On Leave" value={s.employees.onLeave} />
                  <SummaryItem label="Terminated" value={s.employees.terminated} />
                  <SummaryItem label="Departments" value={s.employees.byDepartment.length} />
                </div>
              )}
              {d?.departmentStats && d.departmentStats.length > 0 && (
                <div className="mt-3 space-y-1 text-sm">
                  {d.departmentStats.slice(0, 5).map((dept) => (
                    <div key={dept.department} className="flex justify-between">
                      <span className="text-muted-foreground truncate">{dept.department}</span>
                      <span className="font-medium">{dept.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>

            <DashboardCard title="Contracts" link="/admin/hr/contracts" isLoading={stats.isLoading}>
              {s && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <SummaryItem label="Active" value={s.contracts.active} />
                  <SummaryItem label="Expired" value={s.contracts.expired} />
                  <SummaryItem label="Expiring Soon" value={s.contracts.expiringSoon} accent="warning" />
                  <SummaryItem label="Total" value={s.contracts.total} />
                </div>
              )}
            </DashboardCard>

            <DashboardCard title="Time Off" link="/admin/hr/time-off" isLoading={stats.isLoading}>
              {s && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <SummaryItem label="Pending" value={s.timeOff.pending} accent="warning" />
                  <SummaryItem label="Approved" value={s.timeOff.approved} accent="success" />
                  <SummaryItem label="Rejected" value={s.timeOff.rejected} accent="destructive" />
                  <SummaryItem label="Total" value={s.timeOff.total} />
                </div>
              )}
            </DashboardCard>

            <DashboardCard title="Timesheets" link="/admin/hr/timesheets" isLoading={stats.isLoading}>
              {s && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <SummaryItem label="Active" value={s.timesheets.active} accent="warning" />
                  <SummaryItem label="Completed" value={s.timesheets.completed} />
                  <SummaryItem label="Approved" value={s.timesheets.approved} accent="success" />
                  <SummaryItem label="Rejected" value={s.timesheets.rejected} accent="destructive" />
                </div>
              )}
            </DashboardCard>

            <DashboardCard title="Shifts" link="/admin/hr/shifts" isLoading={stats.isLoading}>
              {s && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <SummaryItem label="Today" value={s.shifts.today} accent="primary" />
                  <SummaryItem label="Upcoming" value={s.shifts.upcoming} />
                  <SummaryItem label="Completed" value={s.shifts.completed} accent="success" />
                  <SummaryItem label="Cancelled" value={s.shifts.cancelled} accent="destructive" />
                </div>
              )}
            </DashboardCard>

            <DashboardCard title="Payslips" link="/admin/hr/payslips" isLoading={stats.isLoading}>
              {s && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <SummaryItem label="Draft" value={s.payslips.draft} />
                  <SummaryItem label="Generated" value={s.payslips.generated} accent="warning" />
                  <SummaryItem label="Paid" value={s.payslips.paid} accent="success" />
                  <SummaryItem label="Sent" value={s.payslips.sent} />
                </div>
              )}
            </DashboardCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <DashboardCard title="Clocked In Now" link="/admin/hr/time-clock" isLoading={dashboard.isLoading}>
              {d?.clockedInEmployees && d.clockedInEmployees.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {d.clockedInEmployees.slice(0, 6).map((emp) => (
                    <div key={emp.id} className="flex justify-between">
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.department}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(emp.clockInTime as string)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active clock-ins.</p>
              )}
            </DashboardCard>

            <DashboardCard title="Recent Announcements" link="/admin/hr/announcements" isLoading={dashboard.isLoading}>
              {d?.recentAnnouncements && d.recentAnnouncements.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {d.recentAnnouncements.slice(0, 6).map((a) => (
                    <div key={a.id}>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.status} · {formatDate(a.publish_at || a.created_at)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent announcements.</p>
              )}
            </DashboardCard>
          </div>
        </>
      )}
    </PageShell>
  );
}

function DashboardCard({ title, link, isLoading, children }: { title: string; link: string; isLoading?: boolean; children: React.ReactNode }) {
  return (
    <Card className="nm-raised">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-auto px-0 py-0">
          <Link href={link} className="text-xs text-primary hover:underline flex items-center">View <ArrowRight className="ml-1 h-3 w-3" /></Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-20 w-full" /> : children}
      </CardContent>
    </Card>
  );
}

function SummaryItem({ label, value, accent }: { label: string; value: number; accent?: 'success' | 'warning' | 'destructive' | 'primary' }) {
  const color = accent === 'success' ? 'text-green-600' : accent === 'warning' ? 'text-yellow-600' : accent === 'destructive' ? 'text-destructive' : '';
  return (
    <div className="flex justify-between border-b pb-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}
