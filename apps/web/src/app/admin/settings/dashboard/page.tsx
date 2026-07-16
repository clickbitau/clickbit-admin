'use client';
import { LayoutDashboard as LayoutDashboardIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardStats } from '@/lib/api';

export default function AdminSettingsDashboardPage() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-stats', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchDashboardStats(token); }, enabled: !!token });

  if (isLoading) return <div className="min-h-screen bg-background p-6"><Skeleton className="h-40 w-full" /></div>;

  const stats = data || {};
  const cards = [
    { label: 'Users', value: stats.totalUsers },
    { label: 'Blog Posts', value: stats.totalBlogPosts },
    { label: 'Portfolio Items', value: stats.totalPortfolioItems },
    { label: 'Contacts', value: stats.totalContacts },
    { label: 'Services', value: stats.totalServices },
    { label: 'Orders', value: stats.totalOrders },
    { label: 'Revenue', value: stats.totalRevenue },
    { label: 'Monthly Revenue', value: stats.monthlyRevenue },
  ];

  return (
    <PageShell
      title="Dashboard Stats"
      icon={LayoutDashboardIcon}
    >
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{c.value ?? 0}</div></CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}