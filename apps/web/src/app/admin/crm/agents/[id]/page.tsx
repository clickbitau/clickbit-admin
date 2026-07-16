'use client';

import { PageShell } from '@/components/design-system/PageShell';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/design-system/DataTable';
import { FormDialog } from '@/components/design-system/FormDialog';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchContact, fetchAgentClients, updateAgentCommission } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Company } from '@/types/crm';
import { ArrowLeft, Building2, Mail, Phone, Headphones } from 'lucide-react';
import { toast } from 'sonner';

export default function AgentDetailPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const params = useParams();
  const id = String(params.id);
  const [editOpen, setEditOpen] = useState(false);

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => fetchContact(token!, id),
    enabled: !!token && !!id,
  });

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['agent-clients', id],
    queryFn: () => fetchAgentClients(token!, id),
    enabled: !!token && !!id,
  });

  useRealtimeRefresh(['contacts'], ['agent', id], { enabled: !!id });

  const commissionMutation = useMutation({
    mutationFn: (data: { commission_type: 'none' | 'percentage' | 'fixed_amount'; commission_rate: number }) =>
      updateAgentCommission(token!, id, data),
    onSuccess: () => {
      toast.success('Commission updated');
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  if (isLoading) return <PageShell title="Agent" icon={Headphones} description="Loading..."><div className="p-6 text-sm text-muted-foreground">Loading agent...</div></PageShell>;
  if (!agent) return <PageShell title="Agent" icon={Headphones} description="Not found"><div className="p-6 text-sm text-muted-foreground">Agent not found.</div></PageShell>;

  return (
    <PageShell
      title={agent.name}
      icon={Headphones}
      description={agent.email || 'Agent detail'}
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/crm/agents"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <Button size="sm" onClick={() => setEditOpen(true)}>Edit Commission</Button>
        </div>
      }
    >
      <AgentHeader agent={agent} />

        <Card>
          <CardHeader>
            <CardTitle>Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={[
                { key: 'company', label: 'Company' },
                { key: 'revenue', label: 'Revenue' },
                { key: 'stage', label: 'Stage' },
              ]}
              data={clients ?? []}
              keyExtractor={(c: Company) => c.id}
              loading={clientsLoading}
              renderRow={(c: Company) => [
                <div key="company">
                  <Link href={`/admin/crm/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                  <p className="text-xs text-muted-foreground">{c.effective_email}</p>
                </div>,
                <span key="revenue">{formatCurrency(Number(c.total_revenue ?? 0))}</span>,
                <span key="stage">{c.lifecycle_stage || '-'}</span>,
              ]}
            />
          </CardContent>
        </Card>

        <FormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          title="Edit Commission"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            commissionMutation.mutate({
              commission_type: String(data.get('commission_type') ?? 'none') as 'none' | 'percentage' | 'fixed_amount',
              commission_rate: Number(data.get('commission_rate') || 0),
            });
          }}
          loading={commissionMutation.isPending}
        >
          <div className="grid gap-2">
            <Label htmlFor="commission_type">Commission Type</Label>
            <Select name="commission_type" defaultValue={agent.commission_type ?? 'none'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="commission_rate">Rate</Label>
            <Input id="commission_rate" name="commission_rate" type="number" defaultValue={agent.commission_rate ?? 0} />
          </div>
        </FormDialog>
    </PageShell>
  );
}

function AgentHeader({ agent }: { agent: { name: string; email?: string | null; phone?: string | null; company?: string | null; commission_type?: string; commission_rate?: number } }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-lg font-bold text-white">
          {agent.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {agent.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {agent.email}</span>}
            {agent.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {agent.phone}</span>}
            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {agent.company || '-'}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{agent.commission_type || 'none'} {agent.commission_type !== 'none' ? agent.commission_rate : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
