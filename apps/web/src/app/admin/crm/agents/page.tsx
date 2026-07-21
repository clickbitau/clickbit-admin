'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { DataTable } from '@/components/design-system/DataTable';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { FormDialog } from '@/components/design-system/FormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchAgents, updateContact } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { CrmContact } from '@/types/crm';
import {
  Headphones,
  Users2,
  UserPlus,
  DollarSign,
  TrendingUp,
  Search,
  Edit,
  ArrowRight,
  Receipt,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AgentsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CrmContact | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => fetchAgents(token!),
    enabled: !!token,
  });

  useRealtimeRefresh(['contacts'], ['agents'], { enabled: !!token });

  const agents = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return agents;
    return agents.filter((a) =>
      [a.name, a.email, a.phone, a.company, a.primary_company?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [agents, search]);

  const totals = useMemo(() => {
    const totalClients = filtered.reduce((s, a) => s + (a.client_count || 0), 0);
    const ownRevenue = filtered.reduce((s, a) => s + (a.total_revenue || 0), 0);
    const clientRevenue = filtered.reduce((s, a) => s + (a.client_revenue || 0), 0);
    const commissionDue = filtered.reduce((s, a) => s + (a.commission_due || 0), 0);
    return {
      totalAgents: filtered.length,
      totalClients,
      ownRevenue,
      clientRevenue,
      totalPortfolio: ownRevenue + clientRevenue,
      commissionDue,
    };
  }, [filtered]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CrmContact>) => updateContact(token!, String(editing!.id), data),
    onSuccess: () => {
      toast.success('Agent updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update agent'),
  });

  const stats = [
    { label: 'Total Agents', value: totals.totalAgents, icon: Users2 },
    { label: 'Total Clients', value: totals.totalClients, icon: UserPlus, accent: 'primary' as const },
    { label: 'Own Revenue', value: formatCurrency(totals.ownRevenue), icon: DollarSign, accent: 'success' as const, sub: 'Direct agent invoices' },
    { label: 'Client Revenue', value: formatCurrency(totals.clientRevenue), icon: DollarSign, accent: 'success' as const, sub: 'Revenue from referred clients' },
    { label: 'Total Portfolio', value: formatCurrency(totals.totalPortfolio), icon: TrendingUp, accent: 'secondary' as const, sub: 'Own + client revenue' },
    { label: 'Commission Due', value: formatCurrency(totals.commissionDue), icon: DollarSign, accent: 'warning' as const },
  ];

  return (
    <PageShell
      title="Agent Management"
      icon={Headphones}
      description="Manage referral agents and their client portfolios"
    >
      <StatCards cards={stats} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} agent{filtered.length === 1 ? '' : 's'}
        </div>
      </div>

      <DataTable
        headers={[
          { key: 'agent', label: 'Agent' },
          { key: 'clients', label: 'Clients' },
          { key: 'own-revenue', label: 'Own Revenue' },
          { key: 'client-revenue', label: 'Client Revenue' },
          { key: 'commission', label: 'Commission' },
          { key: 'actions', label: '' },
        ]}
        data={filtered}
        keyExtractor={(a) => a.id}
        loading={isLoading}
        emptyText="No agents found. Promote a contact from the Customers page."
        onRowClick={(a) => window.open(`/admin/crm/agents/${a.id}`, '_self')}
        renderRow={(a) => [
          <div key="agent" className="flex items-center gap-3 min-w-[200px]">
            <PersonAvatar name={a.name} avatar_url={a.primary_company?.logo_url || a.avatar_url} size="md" />
            <div className="min-w-0">
              <Link
                href={`/admin/crm/agents/${a.id}`}
                className="font-medium hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {a.name}
              </Link>
              <p className="text-xs text-muted-foreground truncate">{a.email}</p>
              {(a.primary_company?.name || a.company) && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {a.primary_company?.name || a.company}
                </p>
              )}
            </div>
          </div>,
          <span key="clients" className="font-medium text-blue-600">{a.client_count ?? 0}</span>,
          <span key="own-revenue" className="font-medium text-emerald-600">{formatCurrency(a.total_revenue ?? 0)}</span>,
          <span key="client-revenue" className="font-medium text-green-600">{formatCurrency(a.client_revenue ?? 0)}</span>,
          <div key="commission" className="flex flex-col gap-0.5">
            <Badge variant="outline">
              {a.commission_type === 'percentage' ? `${a.commission_rate}%` : a.commission_type === 'fixed_amount' ? `$${a.commission_rate}/client` : 'None'}
            </Badge>
            {a.commission_type !== 'none' && (
              <span className="text-xs text-muted-foreground">{formatCurrency(a.commission_due ?? 0)}</span>
            )}
          </div>,
          <div key="actions" className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/admin/finance/invoices?customer=${a.id}`}>
                <Receipt className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditing(a)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/admin/crm/agents/${a.id}`}>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>,
        ]}
      />

      {editing && (
        <FormDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title="Edit Agent"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            updateMutation.mutate({
              name: String(data.get('name') || ''),
              email: String(data.get('email') || ''),
              phone: String(data.get('phone') || ''),
              company: String(data.get('company') || ''),
              job_title: String(data.get('job_title') || ''),
            });
          }}
          loading={updateMutation.isPending}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" defaultValue={editing.name} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={editing.email || ''} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={editing.phone || ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company">Company</Label>
            <Input id="company" name="company" defaultValue={editing.company || ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="job_title">Job Title</Label>
            <Input id="job_title" name="job_title" defaultValue={editing.job_title || ''} />
          </div>
        </FormDialog>
      )}
    </PageShell>
  );
}
