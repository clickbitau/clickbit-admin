'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  fetchDashboardStats,
  fetchFinanceDashboard,
  fetchHrDashboard,
  syncEmployees,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { DashboardStats, FinanceDashboardData, FinanceTrendPoint } from '@/types/dashboard';
import type { HrDashboardData } from '@/types/hr';
import {
  Home,
  Users,
  DollarSign,
  AlertCircle,
  ShoppingCart,
  Mail,
  TrendingUp,
  Globe,
  BarChart3,
  MessageSquare,
  Receipt,
  Ticket,
  ChevronRight,
  Clock,
  Palmtree,
  Calendar,
  Timer,
  RefreshCw,
  Building2,
  Megaphone,
  Wallet,
  Target,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckSquare,
} from 'lucide-react';
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from 'recharts';

const tabs = [
  { id: 'business', label: 'Business', icon: Home },
  { id: 'hr', label: 'HR', icon: Users },
  { id: 'finance', label: 'Finance', icon: DollarSign },
];

const periodOptions = [
  { value: 0, label: 'All Time' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'Last year' },
];

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  gradient,
  iconBg,
  iconColor,
  valueColor,
  to,
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  gradient?: string;
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
  to?: string;
  trend?: number;
}) {
  const content = (
    <div className={`nm-raised p-4 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 ${gradient || ''}`}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg || 'bg-gray-100 dark:bg-gray-700'}`}>
          <Icon className={`w-4 h-4 ${iconColor || 'text-gray-500'}`} />
        </div>
      </div>
      <div className={`text-2xl font-bold ${valueColor || 'text-gray-900 dark:text-white'}`}>{value}</div>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-1 mt-1">
          {trend !== undefined &&
            (trend >= 0 ? (
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
            ) : (
              <ArrowDownRight className="w-3 h-3 text-red-500" />
            ))}
          <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>
        </div>
      )}
    </div>
  );
  return to ? <Link href={to}>{content}</Link> : content;
}

function TabSwitcher({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div className="nm-concave flex rounded-xl p-1 gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'nm-raised text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

function BusinessTab({ data, loading }: { data?: DashboardStats; loading: boolean }) {
  if (loading || !data) return <DashboardSkeleton />;

  const cards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(data.totalRevenue),
      icon: DollarSign,
      gradient: 'bg-gradient-to-br from-emerald-50 to-emerald-50/40 dark:from-emerald-900/20 dark:to-emerald-900/10',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      valueColor: 'text-emerald-700 dark:text-emerald-300',
      to: '/admin/dashboard?tab=finance',
      sub: `Monthly: ${formatCurrency(data.monthlyRevenue)}`,
    },
    {
      label: 'Outstanding',
      value: formatCurrency(data.totalDue),
      icon: AlertCircle,
      gradient: 'bg-gradient-to-br from-amber-50 to-amber-50/40 dark:from-amber-900/20 dark:to-amber-900/10',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      valueColor: 'text-amber-700 dark:text-amber-300',
      to: '/admin/finance/invoices',
      sub: 'Unpaid invoices',
    },
    {
      label: 'Orders',
      value: data.totalOrders,
      icon: ShoppingCart,
      gradient: 'bg-gradient-to-br from-violet-50 to-violet-50/40 dark:from-violet-900/20 dark:to-violet-900/10',
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      valueColor: 'text-violet-700 dark:text-violet-300',
      to: '/admin/finance/orders',
    },
    {
      label: 'Total Leads',
      value: data.totalLeads,
      icon: Mail,
      gradient: 'bg-gradient-to-br from-[#1FBBD2]/10 to-[#1FBBD2]/5 dark:from-[#1FBBD2]/20 dark:to-[#1FBBD2]/10',
      iconBg: 'bg-[#1FBBD2]/10 dark:bg-[#1FBBD2]/20',
      iconColor: 'text-[#1FBBD2]',
      valueColor: 'text-[#1FBBD2]',
      to: '/admin/crm/leads',
      sub: `+${data.newContactsThisMonth} this month`,
      trend: data.contactGrowth,
    },
    {
      label: 'New This Week',
      value: data.newContactsThisWeek,
      icon: TrendingUp,
      gradient: 'bg-gradient-to-br from-blue-50 to-blue-50/40 dark:from-blue-900/20 dark:to-blue-900/10',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      valueColor: 'text-blue-700 dark:text-blue-300',
      sub: 'New leads',
    },
    {
      label: 'Blog Posts',
      value: `${data.publishedPosts} / ${data.totalBlogPosts}`,
      icon: Globe,
      gradient: 'bg-gradient-to-br from-pink-50 to-pink-50/40 dark:from-pink-900/20 dark:to-pink-900/10',
      iconBg: 'bg-pink-100 dark:bg-pink-900/30',
      iconColor: 'text-pink-600 dark:text-pink-400',
      valueColor: 'text-pink-700 dark:text-pink-300',
      to: '/admin/content/blog',
      sub: 'Published / Total',
    },
    {
      label: 'Traffic (30d)',
      value: data.totalAnalyticsEvents.toLocaleString(),
      icon: BarChart3,
      gradient: 'bg-gradient-to-br from-indigo-50 to-indigo-50/40 dark:from-indigo-900/20 dark:to-indigo-900/10',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      valueColor: 'text-indigo-700 dark:text-indigo-300',
      to: '/admin/analytics',
      sub: 'Page views',
    },
    {
      label: 'Pending Comments',
      value: data.pendingComments,
      icon: MessageSquare,
      gradient: 'bg-gradient-to-br from-orange-50 to-orange-50/40 dark:from-orange-900/20 dark:to-orange-900/10',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
      valueColor: 'text-orange-700 dark:text-orange-300',
      to: '/admin/content/comments',
      sub: 'Needs review',
    },
  ];

  return (
    <div className="space-y-6">
      {data.myTaskStats.total > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            My Work
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="My Tasks"
              value={data.myTaskStats.total}
              icon={CheckSquare}
              gradient="bg-gradient-to-br from-violet-50 to-violet-50/40 dark:from-violet-900/20 dark:to-violet-900/10"
              iconBg="bg-violet-100 dark:bg-violet-900/30"
              iconColor="text-violet-600 dark:text-violet-400"
              valueColor="text-violet-700 dark:text-violet-300"
              to="/admin/crm/project-tasks"
              sub={
                data.myTaskStats.overdue > 0
                  ? `${data.myTaskStats.overdue} overdue`
                  : `${data.myTaskStats.inProgress} in progress`
              }
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="nm-raised p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: '/admin/crm/leads/new', label: 'New Lead', icon: Mail, color: 'bg-[#1FBBD2]/10 text-[#1FBBD2]' },
            { to: '/admin/finance/invoices/new', label: 'New Invoice', icon: Receipt, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
            { to: '/admin/support', label: 'View Tickets', icon: Ticket, color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' },
            { to: '/admin/content/blog/new', label: 'New Blog Post', icon: Globe, color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' },
          ].map((a) => (
            <Link
              key={a.to}
              href={a.to}
              className="flex items-center gap-2.5 p-3 rounded-xl hover:brightness-[0.97] dark:hover:brightness-110 transition-all duration-200 group"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.color}`}>
                <a.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                {a.label}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function HRTab({ data, loading }: { data?: HrDashboardData; loading: boolean }) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!window.confirm('Sync all admins/managers as employees?')) return;
    try {
      setSyncing(true);
      const res = await syncEmployees(token!);
      toast.success(`Sync complete: ${res.data.created} created, ${res.data.skipped} skipped`);
      queryClient.invalidateQueries({ queryKey: ['hr-dashboard'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const s = data.stats;
  const hrCards = [
    {
      label: 'Active Employees',
      value: s.activeEmployees ?? 0,
      icon: Users,
      gradient: 'bg-gradient-to-br from-[#1FBBD2]/10 to-[#1FBBD2]/5 dark:from-[#1FBBD2]/20 dark:to-[#1FBBD2]/10',
      iconBg: 'bg-[#1FBBD2]/10 dark:bg-[#1FBBD2]/20',
      iconColor: 'text-[#1FBBD2]',
      valueColor: 'text-[#1FBBD2]',
      to: '/admin/hr/employees',
    },
    {
      label: 'Clocked In Now',
      value: s.clockedInCount ?? 0,
      icon: Clock,
      gradient: 'bg-gradient-to-br from-emerald-50 to-emerald-50/40 dark:from-emerald-900/20 dark:to-emerald-900/10',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      valueColor: 'text-emerald-700 dark:text-emerald-300',
      to: '/admin/hr/time-clock',
    },
    {
      label: 'On Leave Today',
      value: s.onLeaveToday ?? 0,
      icon: Palmtree,
      gradient: 'bg-gradient-to-br from-amber-50 to-amber-50/40 dark:from-amber-900/20 dark:to-amber-900/10',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      valueColor: 'text-amber-700 dark:text-amber-300',
      to: '/admin/hr/time-off',
    },
    {
      label: 'Pending Time Off',
      value: s.pendingTimeOff ?? 0,
      icon: Calendar,
      gradient: 'bg-gradient-to-br from-violet-50 to-violet-50/40 dark:from-violet-900/20 dark:to-violet-900/10',
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      valueColor: 'text-violet-700 dark:text-violet-300',
      to: '/admin/hr/time-off',
      sub: 'Awaiting approval',
    },
    {
      label: "Today's Shifts",
      value: s.todayShifts ?? 0,
      icon: Timer,
      gradient: 'bg-gradient-to-br from-blue-50 to-blue-50/40 dark:from-blue-900/20 dark:to-blue-900/10',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      valueColor: 'text-blue-700 dark:text-blue-300',
      to: '/admin/hr/timesheets',
    },
    {
      label: 'Timesheet Approvals',
      value: s.overdueTimeEntries ?? 0,
      icon: AlertCircle,
      gradient:
        (s.overdueTimeEntries ?? 0) > 0
          ? 'bg-gradient-to-br from-red-50 to-red-50/40 dark:from-red-900/20 dark:to-red-900/10'
          : 'bg-gradient-to-br from-gray-50 to-gray-50/40 dark:from-gray-800 dark:to-gray-800',
      iconBg: (s.overdueTimeEntries ?? 0) > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700',
      iconColor: (s.overdueTimeEntries ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500',
      valueColor: (s.overdueTimeEntries ?? 0) > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300',
      to: '/admin/hr/timesheets',
      sub: 'Pending review',
    },
  ];

  const totalDept = data.departmentStats?.reduce((sum, d) => sum + d.count, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Employees'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {hrCards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="nm-raised p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Currently Clocked In
            </h3>
            <Link href="/admin/hr/time-clock" className="text-xs text-[#1FBBD2] hover:underline">
              View all
            </Link>
          </div>
          {(data.clockedInEmployees?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {data.clockedInEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 nm-surface rounded-xl gap-2 sm:gap-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{emp.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {emp.department} · In {formatDate(emp.clockInTime)}
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse self-start sm:self-auto hidden sm:block" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No employees currently clocked in</p>
          )}
        </div>

        <div className="nm-raised p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Employees by Department</h3>
            <Building2 className="w-4 h-4 text-gray-400" />
          </div>
          {(data.departmentStats?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {data.departmentStats.map((dept, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">{dept.department || 'Unassigned'}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{dept.count}</span>
                  </div>
                  <Progress value={(dept.count / totalDept) * 100} className="h-2" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No department data</p>
          )}
        </div>

        <div className="nm-raised p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Announcements</h3>
            <Link href="/admin/hr/announcements" className="text-xs text-[#1FBBD2] hover:underline">
              View all
            </Link>
          </div>
          {(data.recentAnnouncements?.length ?? 0) > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.recentAnnouncements.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      a.priority === 'critical'
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : a.priority === 'high'
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}
                  >
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(a.publish_at)}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.type === 'urgent'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {a.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No announcements yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FinanceChart({ data }: { data: FinanceTrendPoint[] }) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-gray-900 p-3 rounded-xl shadow-xl border border-gray-700 text-sm">
        <p className="text-gray-300 font-medium mb-2">{label}</p>
        {payload.map((e: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
            <span className="text-gray-400">{e.name}:</span>
            <span className="text-white font-semibold">{formatCurrency(e.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="nm-raised p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">Revenue vs Expenses</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Revenue
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Expenses
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Profit
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="revenue" fill="url(#revGrad)" stroke="#10b981" strokeWidth={2} name="Revenue" />
          <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name="Expenses" />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            name="Profit"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function FinanceTab({
  data,
  loading,
  period,
  onPeriodChange,
}: {
  data?: FinanceDashboardData;
  loading: boolean;
  period: number;
  onPeriodChange?: (value: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<'orders' | 'expenses' | 'payments'>('orders');

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const overview = data.overview;

  const pctChange = (cur: number, prev?: number) => {
    if (!prev || prev === 0) return null;
    return ((cur - prev) / prev * 100).toFixed(1);
  };
  const revChange = pctChange(overview.periodRevenue, overview.previousPeriodRevenue);
  const expChange = pctChange(overview.periodExpenses, overview.previousPeriodExpenses);
  const profChange = pctChange(overview.periodProfit, overview.previousPeriodProfit);
  const periodLabel =
    period === 0 ? 'All time' : period === 7 ? 'Last 7d' : period === 30 ? 'Last 30d' : period === 90 ? 'Last 90d' : 'Last year';
  const periodMargin =
    overview.periodRevenue > 0 ? ((overview.periodProfit / overview.periodRevenue) * 100).toFixed(2) : '0.00';

  const finCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(overview.periodRevenue),
      icon: Wallet,
      gradient: 'bg-gradient-to-br from-emerald-50 to-emerald-50/40 dark:from-emerald-900/20 dark:to-emerald-900/10',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      valueColor: 'text-emerald-700 dark:text-emerald-300',
      sub: revChange ? `${Number(revChange) >= 0 ? '+' : ''}${revChange}% vs prev period` : `All time: ${formatCurrency(overview.totalRevenue)}`,
      trend: revChange ? Number(revChange) : undefined,
    },
    {
      label: 'Total Expenses',
      value: formatCurrency(overview.periodExpenses),
      icon: Receipt,
      gradient: 'bg-gradient-to-br from-red-50 to-red-50/40 dark:from-red-900/20 dark:to-red-900/10',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      valueColor: 'text-red-700 dark:text-red-300',
      sub: expChange ? `${Number(expChange) >= 0 ? '+' : ''}${expChange}% vs prev period` : `All time: ${formatCurrency(overview.totalExpenses)}`,
      trend: expChange ? Number(expChange) : undefined,
    },
    {
      label: 'Net Profit',
      value: formatCurrency(overview.periodProfit),
      icon: Target,
      gradient:
        overview.periodProfit >= 0
          ? 'bg-gradient-to-br from-blue-50 to-blue-50/40 dark:from-blue-900/20 dark:to-blue-900/10'
          : 'bg-gradient-to-br from-orange-50 to-orange-50/40 dark:from-orange-900/20 dark:to-orange-900/10',
      iconBg: overview.periodProfit >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: overview.periodProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600',
      valueColor: overview.periodProfit >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700',
      sub: `Margin: ${periodMargin}%`,
      trend: profChange ? Number(profChange) : undefined,
    },
    {
      label: 'Period Profit',
      value: formatCurrency(overview.periodProfit),
      icon: Sparkles,
      gradient: 'bg-gradient-to-br from-[#1FBBD2]/10 to-[#1FBBD2]/5 dark:from-[#1FBBD2]/20 dark:to-[#1FBBD2]/10',
      iconBg: 'bg-[#1FBBD2]/10 dark:bg-[#1FBBD2]/20',
      iconColor: 'text-[#1FBBD2]',
      valueColor: 'text-[#1FBBD2]',
      sub: overview.periodProfit >= 0 ? `Profitable · ${periodLabel}` : `Loss · ${periodLabel}`,
    },
  ];

  const recentItems = data.recent?.[activeTab] || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="nm-concave flex items-center gap-2 px-3 py-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={period}
            onChange={(e) => onPeriodChange?.(Number(e.target.value))}
            className="bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
          >
            {periodOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {finCards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <FinanceChart data={data.trends.monthly} />

      <div className="nm-raised overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-5 pt-4">
          {(['orders', 'expenses', 'payments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 mr-6 text-sm font-medium capitalize transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-[#1FBBD2] text-[#1FBBD2]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab}{' '}
              <span className="ml-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded-full">
                {data.recent[tab]?.length ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {recentItems.length > 0 ? (
            recentItems.slice(0, 5).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.customer_name || item.vendor || item.description || item.client_name || item.transaction_id || '—'}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(item.created_at || item.date || item.payment_date || item.expense_date)}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    activeTab === 'expenses' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {activeTab === 'expenses' ? '-' : '+'}
                  {formatCurrency(item.total_amount || item.total || item.amount || 0)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No recent {activeTab}</p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
          <Link href={`/admin/finance/${activeTab}`} className="text-xs text-[#1FBBD2] hover:underline">
            View all {activeTab} →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'business' | 'hr' | 'finance') || 'business';

  const setTab = (id: string) => {
    router.replace(`/admin${id === 'business' ? '' : `?tab=${id}`}`, { scroll: false });
  };

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', token],
    queryFn: () => fetchDashboardStats(token!),
    enabled: !!token,
  });

  const { data: hrData, isLoading: hrLoading } = useQuery({
    queryKey: ['hr-dashboard', token],
    queryFn: () => fetchHrDashboard(token!),
    enabled: !!token && activeTab === 'hr',
  });

  const [financePeriod, setFinancePeriod] = useState(30);

  const { data: financeData, isLoading: financeLoading } = useQuery({
    queryKey: ['finance-dashboard', token, financePeriod],
    queryFn: () => fetchFinanceDashboard(token!, financePeriod),
    enabled: !!token && activeTab === 'finance',
  });

  const stats = statsData?.data;
  const hr = hrData?.data;
  const finance = financeData?.data;

  const tabContent = {
    business: <BusinessTab data={stats} loading={statsLoading} />,
    hr: <HRTab data={hr} loading={hrLoading} />,
    finance: <FinanceTab data={finance} loading={financeLoading} period={financePeriod} onPeriodChange={setFinancePeriod} />,
  };

  return (
    <PageShell
      title={`Welcome back, ${user?.first_name || ''}`}
      description="Here's what's happening across your business today."
      icon={Home}
      actions={<TabSwitcher active={activeTab} onChange={setTab} />}
    >
      {tabContent[activeTab] || tabContent.business}
    </PageShell>
  );
}
