'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchAgentPortalDashboard } from '@/lib/api';
import {
  Users2, DollarSign, Receipt, FolderKanban, AlertCircle,
  Briefcase, ArrowRight, Building2, Mail, Percent, Phone,
} from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value?: string | Date) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-AU');
}

export default function AgentDashboardPage() {
  const { token, user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['agent-dashboard', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAgentPortalDashboard(token); },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const agent = data?.agent;
  const stats = data?.stats || {};
  const clients = (data?.clients || []) as Array<{
    id: number; name: string; email?: string; phone?: string; company?: string; total_revenue: number; lifecycle_stage?: string; created_at?: string; last_contacted_at?: string;
  }>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Welcome Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-700">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full -ml-20 -mb-20" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <Briefcase className="w-6 h-6" />
            <span className="text-indigo-200 text-sm font-medium">Agent Portal</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">Welcome back, {agent?.name || user?.first_name || 'Agent'}!</h1>
          <p className="text-indigo-200">
            {agent?.company && `${agent.company} · `}Here&apos;s your client portfolio overview.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Users2 className="w-5 h-5 text-blue-500" />
              <span className="text-sm">My Clients</span>
            </div>
            <div className="text-3xl font-bold">{stats.total_clients || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              <span className="text-sm">Client Revenue</span>
            </div>
            <div className="text-3xl font-bold text-emerald-600">{formatCurrency(stats.client_revenue || 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">Own: {formatCurrency(stats.own_revenue || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Receipt className="w-5 h-5 text-purple-500" />
              <span className="text-sm">Invoices</span>
            </div>
            <div className="text-3xl font-bold">{stats.total_invoices || 0}</div>
            {stats.outstanding_amount > 0 && (
              <div className="text-xs text-amber-500 mt-1">{formatCurrency(stats.outstanding_amount)} outstanding</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <FolderKanban className="w-5 h-5 text-orange-500" />
              <span className="text-sm">Active Projects</span>
            </div>
            <div className="text-3xl font-bold">{stats.active_projects || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Commission + Overdue row */}
      {(stats.commission_due > 0 || stats.overdue_amount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.commission_due > 0 && (
            <Card className="bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Commission Due</span>
                </div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(stats.commission_due)}</div>
                <div className="text-xs text-amber-600/70 mt-1">
                  {agent?.commission_type === 'percentage' ? `${agent.commission_rate}% of client revenue` : `${formatCurrency(agent?.commission_rate || 0)} per client`}
                </div>
              </CardContent>
            </Card>
          )}
          {stats.overdue_amount > 0 && (
            <Card className="bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">Overdue Invoices</span>
                </div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(stats.overdue_amount)}</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Clients List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users2 className="w-5 h-5 text-blue-500" />
            My Clients
          </CardTitle>
          <Link href="/agent/clients" className="text-sm text-primary hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {clients.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No clients assigned yet</p>
            </div>
          ) : (
            clients.slice(0, 8).map((client) => (
              <div key={client.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <PersonAvatar name={client.name} size="md" />
                  <div>
                    <div className="font-medium">{client.name}</div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {client.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {client.company}
                        </span>
                      )}
                      {client.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {client.email}
                        </span>
                      )}
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {client.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-emerald-600">{formatCurrency(client.total_revenue || 0)}</div>
                  {client.lifecycle_stage && <Badge variant="outline" className="text-xs mt-1 capitalize">{client.lifecycle_stage}</Badge>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/agent/clients" className="group block">
          <Card className="h-full hover:border-primary/50 transition-all">
            <CardContent className="p-5">
              <Users2 className="w-8 h-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold mb-1">My Clients</h3>
              <p className="text-sm text-muted-foreground">View and manage your client portfolio</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/agent/invoices" className="group block">
          <Card className="h-full hover:border-primary/50 transition-all">
            <CardContent className="p-5">
              <Receipt className="w-8 h-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold mb-1">Invoices</h3>
              <p className="text-sm text-muted-foreground">View invoices for your clients</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/agent/projects" className="group block">
          <Card className="h-full hover:border-primary/50 transition-all">
            <CardContent className="p-5">
              <FolderKanban className="w-8 h-8 text-orange-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold mb-1">Projects</h3>
              <p className="text-sm text-muted-foreground">Track active projects and progress</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
