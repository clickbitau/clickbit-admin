'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchHrDashboard } from '@/lib/api';
import { Users, Clock, Calendar, Briefcase } from 'lucide-react';

export default function AdminHrPage() {
  const { token } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-dashboard', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchHrDashboard(token);
    },
    enabled: !!token,
  });

  const stats = data?.data?.stats;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
          <p className="text-muted-foreground">People, leave, announcements and reminders.</p>
        </div>

        {error ? (
          <div className="text-destructive">Failed to load HR dashboard.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Employees" value={stats?.totalEmployees ?? 0} icon={<Users className="h-4 w-4" />} loading={isLoading} />
            <StatCard title="Active Employees" value={stats?.activeEmployees ?? 0} icon={<Briefcase className="h-4 w-4" />} loading={isLoading} />
            <StatCard title="Clocked In" value={stats?.clockedInCount ?? 0} icon={<Clock className="h-4 w-4" />} loading={isLoading} />
            <StatCard title="Pending Time Off" value={stats?.pendingTimeOff ?? 0} icon={<Calendar className="h-4 w-4" />} loading={isLoading} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, loading }: { title: string; value: number; icon: React.ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>{loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{value}</div>}</CardContent>
    </Card>
  );
}
