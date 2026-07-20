'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { fetchMeStaffAdvances, requestStaffAdvance } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Wallet, Plus, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { StaffAdvance } from '@/types/staff-advances';

export default function EmployeeStaffAdvancesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['employee-staff-advances', token],
    queryFn: () => {
      if (!token) throw new Error('No token');
      return fetchMeStaffAdvances(token);
    },
    enabled: !!token,
  });

  const advances = useMemo(() => data?.data ?? [], [data]);

  const summary = useMemo(() => {
    const active = advances.filter((a) => a.status === 'active');
    const pending = advances.filter((a) => a.status === 'pending');
    const totalOwed = active.reduce((s, a) => s + (a.remaining_balance || 0), 0);
    const total = advances.reduce((s, a) => s + (a.total_amount || 0), 0);
    return { total, totalOwed, activeCount: active.length, pendingCount: pending.length };
  }, [advances]);

  const request = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('No token');
      return requestStaffAdvance(token, {
        title: form.title,
        amount: Number(form.amount),
        notes: form.notes,
        advance_type: 'cash',
      });
    },
    onSuccess: () => {
      toast.success('Advance requested');
      setShowAdd(false);
      setForm({ title: '', amount: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['employee-staff-advances'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to request advance'),
  });

  return (
    <PageShell title="My Advances" icon={Wallet} description="View and request pay advances.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="nm-raised"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Total Advances</p><p className="text-2xl font-bold">{formatCurrency(summary.total)}</p></CardContent></Card>
        <Card className="nm-raised"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Outstanding</p><p className="text-2xl font-bold">{formatCurrency(summary.totalOwed)}</p></CardContent></Card>
        <Card className="nm-raised"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Active</p><p className="text-2xl font-bold">{summary.activeCount}</p></CardContent></Card>
        <Card className="nm-raised"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Pending</p><p className="text-2xl font-bold">{summary.pendingCount}</p></CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)}><Plus className="mr-1 h-4 w-4" /> Request Advance</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : advances.length === 0 ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">No advances found.</Card>
      ) : (
        <div className="space-y-3">
          {advances.map((a: StaffAdvance) => (
            <Card key={a.id} className="nm-raised">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4" /> {a.title}</CardTitle>
                <StatusBadge status={a.status} />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div><p className="text-xs text-muted-foreground">Amount</p><p>{formatCurrency(a.total_amount)}</p></div>
                <div><p className="text-xs text-muted-foreground">Remaining</p><p>{formatCurrency(a.remaining_balance)}</p></div>
                <div><p className="text-xs text-muted-foreground">Date</p><p>{formatDate(a.advance_date)}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4">
          <Card className="nm-raised w-full max-w-md">
            <CardHeader><CardTitle className="text-base">Request Advance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Reason / Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button onClick={() => request.mutate()} disabled={request.isPending || !form.title || !form.amount}>Request</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
