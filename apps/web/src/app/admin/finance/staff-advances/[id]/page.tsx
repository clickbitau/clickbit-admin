'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HandCoins, ArrowLeft, CheckCircle, XCircle, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/design-system/DataTable';
import { approveStaffAdvance, deleteStaffAdvance, fetchStaffAdvance, rejectStaffAdvance } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

function statusBadge(status: string) {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'active':
      return 'default';
    case 'cleared':
      return 'success' as any;
    case 'written_off':
      return 'outline';
    case 'rejected':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export default function StaffAdvanceDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['staff-advance', id, token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchStaffAdvance(token, id);
    },
    enabled: !!token && !!id,
  });

  const approve = useMutation({
    mutationFn: () => approveStaffAdvance(token!, id),
    onSuccess: (res) => { toast.success(res.message); queryClient.invalidateQueries({ queryKey: ['staff-advance', id] }); queryClient.invalidateQueries({ queryKey: ['staff-advances'] }); },
    onError: () => toast.error('Approve failed'),
  });

  const reject = useMutation({
    mutationFn: () => rejectStaffAdvance(token!, id, rejectReason),
    onSuccess: (res) => { toast.success(res.message); queryClient.invalidateQueries({ queryKey: ['staff-advance', id] }); queryClient.invalidateQueries({ queryKey: ['staff-advances'] }); },
    onError: () => toast.error('Reject failed'),
  });

  const remove = useMutation({
    mutationFn: () => deleteStaffAdvance(token!, id),
    onSuccess: (res) => { toast.success(res.message); router.push('/admin/finance/staff-advances'); queryClient.invalidateQueries({ queryKey: ['staff-advances'] }); },
    onError: () => toast.error('Delete failed'),
  });

  const advance = data?.data;

  if (isLoading || !advance) {
    return <PageShell title="Staff Advance" icon={HandCoins} description="Loading..."><div className="p-6 text-sm text-muted-foreground">Loading...</div></PageShell>;
  }

  const employeeName = advance.employee?.profiles
    ? `${advance.employee.profiles.first_name || ''} ${advance.employee.profiles.last_name || ''}`.trim()
    : `Employee #${advance.employee_id}`;

  return (
    <PageShell
      title={advance.title}
      icon={HandCoins}
      description={`${employeeName} · ${advance.advance_type}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/finance/staff-advances"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5" /> Advance Details
            </CardTitle>
            <Badge variant={statusBadge(advance.status)} className="capitalize w-fit">{advance.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Employee</span> <span className="font-medium">{employeeName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span> <span className="capitalize">{advance.advance_type}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Advance Date</span> <span>{formatDate(advance.advance_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span> <span>{formatDate(advance.created_at)}</span></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t">
              <div><p className="text-xs text-muted-foreground uppercase">Total</p><p className="text-lg font-bold">{formatCurrency(advance.total_amount)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase">Remaining</p><p className="text-lg font-bold">{formatCurrency(advance.remaining_balance)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase">Paid Back</p><p className="text-lg font-bold">{formatCurrency(Number(advance.total_amount) - Number(advance.remaining_balance))}</p></div>
            </div>
            {advance.description && <p className="pt-2 text-muted-foreground">{advance.description}</p>}
            {advance.notes && <p className="pt-1 text-muted-foreground">{advance.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {advance.status === 'pending' && (
              <div className="space-y-3">
                <Button className="w-full gap-2" onClick={() => approve.mutate()} disabled={approve.isPending}><CheckCircle className="h-4 w-4" /> Approve</Button>
                <div className="space-y-1">
                  <Label htmlFor="reason">Rejection reason</Label>
                  <Input id="reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason..." />
                </div>
                <Button variant="destructive" className="w-full gap-2" onClick={() => reject.mutate()} disabled={reject.isPending || !rejectReason.trim()}><XCircle className="h-4 w-4" /> Reject</Button>
              </div>
            )}
            {advance.status !== 'pending' && (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground flex items-center gap-2"><AlertCircle className="h-4 w-4" /> No actions available for {advance.status} advances.</div>
            )}
            <Button variant="outline" className="w-full gap-2" onClick={() => { if (window.confirm('Delete this advance?')) remove.mutate(); }} disabled={remove.isPending}><Trash2 className="h-4 w-4" /> Delete</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Deductions</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            headers={[{ key: 'date', label: 'Date' }, { key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount', className: 'text-right' }, { key: 'notes', label: 'Notes' }]}
            data={advance.deductions ?? []}
            keyExtractor={(d) => d.id}
            emptyText="No deductions recorded."
            renderRow={(d) => [
              <span key="date">{formatDate(d.deduction_date)}</span>,
              <Badge key="type" variant="outline" className="capitalize">{d.deduction_type.replace('_', ' ')}</Badge>,
              <span key="amount" className="text-right">{formatCurrency(d.amount)}</span>,
              <span key="notes" className="text-sm text-muted-foreground">{d.notes || '-'}</span>,
            ]}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
