'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { fetchMeStaffAdvances, requestStaffAdvance } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Wallet, Plus, DollarSign, Search, Calendar, TrendingUp, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { StaffAdvance } from '@/types/staff-advances';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'cleared', label: 'Cleared' },
];

export default function EmployeeStaffAdvancesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', notes: '' });
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['employee-staff-advances', token],
    queryFn: () => {
      if (!token) throw new Error('No token');
      return fetchMeStaffAdvances(token);
    },
    enabled: !!token,
  });

  const advances = useMemo(() => data?.data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = advances;
    if (status !== 'all') rows = rows.filter((a) => a.status?.toLowerCase() === status);
    if (q) {
      rows = rows.filter((a) =>
        (a.title?.toLowerCase() || '').includes(q) ||
        (a.notes?.toLowerCase() || '').includes(q) ||
        formatDate(a.advance_date).toLowerCase().includes(q)
      );
    }
    return rows;
  }, [advances, status, search]);

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
    <PageShell
      title="My Advances"
      icon={Wallet}
      description="View and request pay advances."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={status === s.key ? 'default' : 'outline'}
                onClick={() => setStatus(s.key)}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> Request Advance
          </Button>
        </div>
      }
    >
      <StatCards
        cards={[
          { label: 'Total Advances', value: formatCurrency(summary.total), icon: DollarSign, accent: 'primary' },
          { label: 'Outstanding', value: formatCurrency(summary.totalOwed), icon: TrendingUp, accent: 'warning' },
          { label: 'Active', value: summary.activeCount, icon: Wallet, accent: 'success' },
          { label: 'Pending', value: summary.pendingCount, icon: Clock, accent: 'secondary' },
        ]}
      />

      <Card className="nm-raised p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search advances..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : filtered.length === 0 ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">
          {search || status !== 'all' ? 'No advances match your filters.' : 'No advances found.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a: StaffAdvance) => (
            <Card
              key={a.id}
              className={cn(
                'nm-raised hover:shadow-md transition-all border-l-4',
                a.status === 'active' ? 'border-l-emerald-500' :
                a.status === 'pending' ? 'border-l-amber-500' :
                a.status === 'cleared' ? 'border-l-blue-500' : 'border-l-gray-400'
              )}
            >
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> {a.title}</CardTitle>
                <StatusBadge status={a.status} />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div><p className="text-xs text-muted-foreground">Amount</p><p className="font-medium">{formatCurrency(a.total_amount)}</p></div>
                <div><p className="text-xs text-muted-foreground">Remaining</p><p className="font-medium">{formatCurrency(a.remaining_balance)}</p></div>
                <div><p className="text-xs text-muted-foreground">Date</p><p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(a.advance_date)}</p></div>
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
