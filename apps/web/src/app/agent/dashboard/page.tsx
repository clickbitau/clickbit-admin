'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, authHeaders } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { LayoutDashboard, Receipt, FolderKanban, Building2, Ticket, ArrowRight } from 'lucide-react';

const modules = [
  { href: '/agent/invoices', label: 'Invoices', icon: Receipt },
  { href: '/agent/projects', label: 'Projects', icon: FolderKanban },
  { href: '/agent/companies', label: 'Companies', icon: Building2 },
  { href: '/agent/tickets', label: 'Tickets', icon: Ticket },
];

async function fetchAgentDashboard(token: string) {
  const response = await api.get('/api/agent/dashboard', { headers: authHeaders(token) });
  return response.data;
}

export default function AgentDashboardPage() {
  const { token } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-dashboard', token],
    queryFn: () => fetchAgentDashboard(token!),
    enabled: !!token,
  });

  const dashboard = data?.data ?? {};

  return (
    <PageShell
      title="Dashboard"
      icon={LayoutDashboard}
      description="Overview of your clients and work"
      isLoading={isLoading}
      error={error}
    >
      <StatCards
        stats={[
          { label: 'Clients', value: dashboard.clients ?? 0, icon: 'Users' },
          { label: 'Companies', value: dashboard.companies ?? 0, icon: 'Building2' },
          { label: 'Active Projects', value: dashboard.active_projects ?? 0, icon: 'FolderKanban' },
          { label: 'Open Tickets', value: dashboard.open_tickets ?? 0, icon: 'Ticket' },
          { label: 'Total Invoiced', value: formatCurrency(dashboard.total_invoiced ?? 0), icon: 'Receipt' },
          { label: 'Outstanding', value: formatCurrency(dashboard.outstanding ?? 0), icon: 'CreditCard' },
        ]}
      />

      <Card className="nm-raised mt-6">
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.href}
                  href={module.href}
                  className="group flex items-center justify-between p-4 rounded-2xl nm-raised-sm hover:nm-raised transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl nm-raised-sm flex items-center justify-center text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-medium">{module.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
