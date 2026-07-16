'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchCustomerDashboard } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import {
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  FolderKanban,
  CreditCard,
  Files,
  ListTodo,
  Ticket,
  ArrowRight,
} from 'lucide-react';

export default function CustomerDashboardPage() {
  const { token } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-dashboard'],
    queryFn: () => fetchCustomerDashboard(token!),
    enabled: !!token,
  });

  const dashboard = data?.data ?? {};

  const statCards = [
    { label: 'Outstanding', value: isLoading ? '-' : formatCurrency(dashboard.outstanding_balance), icon: Receipt, accent: 'warning' as const },
    { label: 'Total Invoiced', value: isLoading ? '-' : formatCurrency(dashboard.total_invoiced), icon: Receipt, accent: 'primary' as const },
    { label: 'Total Paid', value: isLoading ? '-' : formatCurrency(dashboard.total_paid), icon: CreditCard, accent: 'success' as const },
    { label: 'Projects', value: isLoading ? '-' : dashboard.project_count ?? 0, icon: FolderKanban, accent: 'secondary' as const },
  ];

  const modules = [
    { href: '/customer/invoices', label: 'Invoices', icon: Receipt, count: dashboard.invoice_count },
    { href: '/customer/orders', label: 'Orders', icon: ShoppingCart, count: dashboard.order_count },
    { href: '/customer/projects', label: 'Projects', icon: FolderKanban, count: dashboard.project_count },
    { href: '/customer/payments', label: 'Payments', icon: CreditCard, count: dashboard.payment_count },
    { href: '/customer/documents', label: 'Documents', icon: Files, count: dashboard.document_count },
    { href: '/customer/tasks', label: 'Tasks', icon: ListTodo, count: dashboard.task_count },
    { href: '/customer/tickets', label: 'Tickets', icon: Ticket, count: dashboard.ticket_count },
  ];

  return (
    <PageShell title="Dashboard" icon={LayoutDashboard} description="Overview of your account">
      {error && (
        <div className="rounded-lg border border-destructive p-4 text-destructive">
          Failed to load dashboard.
        </div>
      )}
      <StatCards cards={statCards} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.href} href={m.href} className="group">
              <Card className="h-full nm-raised hover:nm-raised-lg transition-all">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {m.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="stat-value">{isLoading ? '-' : m.count ?? 0}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
