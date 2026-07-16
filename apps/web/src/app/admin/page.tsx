'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardStats } from '@/lib/api';
import { LayoutDashboard, Users, Briefcase, Building2, Wallet, LifeBuoy, MessageSquare, FileText, Settings } from 'lucide-react';

const modules = [
  { label: 'CRM', href: '/admin/crm/pipeline', icon: Briefcase },
  { label: 'HR', href: '/admin/hr', icon: Users },
  { label: 'Finance', href: '/admin/finance/invoices', icon: Wallet },
  { label: 'Support', href: '/admin/support', icon: LifeBuoy },
  { label: 'Communication', href: '/admin/communication', icon: MessageSquare },
  { label: 'Content', href: '/admin/content', icon: FileText },
  { label: 'Admin', href: '/admin/settings', icon: Settings },
];

export default function AdminDashboardPage() {
  const { token } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchDashboardStats(token); },
    enabled: !!token,
  });

  const stats = data || {};
  const statCards = [
    { label: 'Contacts', value: stats.totalContacts ?? 0, icon: Users },
    { label: 'Companies', value: stats.totalCompanies ?? 0, icon: Building2 },
    { label: 'Revenue', value: stats.totalRevenue ?? 0, icon: Wallet },
    { label: 'Orders', value: stats.totalOrders ?? 0, icon: Briefcase },
  ];

  return (
    <PageShell
      title="Dashboard"
      icon={LayoutDashboard}
      description="Overview of your business"
    >
      {isLoading ? <Skeleton className="h-40 w-full" /> : <StatCards cards={statCards} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {modules.map((m) => (
          <Card key={m.label}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <m.icon className="h-5 w-5 text-primary" />
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href={m.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
