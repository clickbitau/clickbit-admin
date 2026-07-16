'use client';
import { LayoutDashboard as LayoutDashboardIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { StatCards } from '@/components/design-system/StatCards';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardStats } from '@/lib/api';

export default function AdminSettingsDashboardPage() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-stats', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchDashboardStats(token); }, enabled: !!token });

  if (isLoading) return <div className="min-h-screen bg-background p-6"><Skeleton className="h-40 w-full" /></div>;

  const stats = data || {};
  const cards = [
    { label: 'Users', value: stats.totalUsers ?? 0, icon: LayoutDashboardIcon },
    { label: 'Blog Posts', value: stats.totalBlogPosts ?? 0, icon: LayoutDashboardIcon },
    { label: 'Portfolio Items', value: stats.totalPortfolioItems ?? 0, icon: LayoutDashboardIcon },
    { label: 'Contacts', value: stats.totalContacts ?? 0, icon: LayoutDashboardIcon },
    { label: 'Services', value: stats.totalServices ?? 0, icon: LayoutDashboardIcon },
    { label: 'Orders', value: stats.totalOrders ?? 0, icon: LayoutDashboardIcon },
    { label: 'Revenue', value: stats.totalRevenue ?? 0, icon: LayoutDashboardIcon },
    { label: 'Monthly Revenue', value: stats.monthlyRevenue ?? 0, icon: LayoutDashboardIcon },
  ];

  return (
    <PageShell
      title="Dashboard Stats"
      icon={LayoutDashboardIcon}
    >
      {isLoading ? <Skeleton className="h-40 w-full" /> : <StatCards cards={cards} />}
    </PageShell>
  );
}