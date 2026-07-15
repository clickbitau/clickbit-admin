'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormDialog } from '@/components/design-system/FormDialog';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchContact, updateContact } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ArrowLeft, Building2, Mail, Phone, Star, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { CrmContact } from '@/types/crm';

export default function CustomerDetailPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const params = useParams();
  const id = String(params.id);
  const [editOpen, setEditOpen] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchContact(token!, id),
    enabled: !!token && !!id,
  });

  useRealtimeRefresh(['contacts'], ['customer', id], { enabled: !!id });

  const updateMutation = useMutation({
    mutationFn: (values: Partial<CrmContact>) => updateContact(token!, id, values),
    onSuccess: () => { toast.success('Customer updated'); setEditOpen(false); queryClient.invalidateQueries({ queryKey: ['customer', id] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading customer...</div>;
  if (!customer) return <div className="p-6 text-sm text-muted-foreground">Customer not found.</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/crm/customers"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <Button size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
        </div>

        <CustomerHeader customer={customer} />

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold text-emerald-600">{formatCurrency(customer.total_revenue ?? 0)}</p></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Lead Score</CardTitle></CardHeader><CardContent className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" /><p className="text-2xl font-semibold">{customer.lead_score ?? 0}</p></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Customer Since</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{formatDate(customer.became_customer_at)}</p></CardContent></Card>
            </div>
          </TabsContent>
          <TabsContent value="details">
            <Card>
              <CardContent className="space-y-3 py-6 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span> <span>{customer.email || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span> <span>{customer.phone || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Company</span> <span>{customer.primary_company?.name || customer.company || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lifecycle Stage</span> <StatusBadge status={customer.lifecycle_stage} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lead Status</span> <span>{customer.lead_status || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Last Contacted</span> <span>{formatDate(customer.last_contacted_at)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span> <span>{formatDate(customer.created_at)}</span></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <FormDialog open={editOpen} onOpenChange={setEditOpen} title="Edit Customer" onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          updateMutation.mutate({
            name: String(data.get('name') ?? ''),
            email: String(data.get('email') ?? ''),
            phone: String(data.get('phone') ?? ''),
            lifecycle_stage: String(data.get('lifecycle_stage') ?? ''),
          });
        }} loading={updateMutation.isPending}>
          <div className="grid gap-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={customer.name} required /></div>
          <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={customer.email ?? ''} /></div>
          <div className="grid gap-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" defaultValue={customer.phone ?? ''} /></div>
          <div className="grid gap-2"><Label htmlFor="lifecycle_stage">Lifecycle Stage</Label><Input id="lifecycle_stage" name="lifecycle_stage" defaultValue={customer.lifecycle_stage ?? 'customer'} /></div>
        </FormDialog>
      </div>
    </div>
  );
}

function CustomerHeader({ customer }: { customer: CrmContact }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-lg font-bold text-white">
          {customer.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>}
            {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>}
            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {customer.primary_company?.name || customer.company || '-'}</span>
            <StatusBadge status={customer.lifecycle_stage} />
          </div>
        </div>
      </div>
    </div>
  );
}
