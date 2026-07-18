'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HandCoins, ArrowLeft, CheckCircle, XCircle, Trash2, AlertCircle, Plus, Pencil, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/design-system/DataTable';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  approveStaffAdvance,
  deleteStaffAdvance,
  fetchStaffAdvance,
  rejectStaffAdvance,
  updateStaffAdvance,
  addStaffAdvanceDeduction,
  removeStaffAdvanceDeduction,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

const deductionTypes = ['pay_deduction', 'cash_repayment', 'manual_adjustment'];

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
  const [showEdit, setShowEdit] = useState(false);
  const [showDeduction, setShowDeduction] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['staff-advance', id, token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchStaffAdvance(token, id);
    },
    enabled: !!token && !!id,
  });

  const advance = data?.data;

  const [editForm, setEditForm] = useState({ title: '', description: '', notes: '', total_amount: '', advance_type: 'cash' as 'asset' | 'cash' | 'loan' });

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

  const update = useMutation({
    mutationFn: () => updateStaffAdvance(token!, id, {
      title: editForm.title,
      description: editForm.description,
      notes: editForm.notes,
      total_amount: editForm.total_amount ? Number(editForm.total_amount) : undefined,
      advance_type: editForm.advance_type,
    }),
    onSuccess: (res) => {
      toast.success('Advance updated');
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ['staff-advance', id] });
      queryClient.invalidateQueries({ queryKey: ['staff-advances'] });
    },
    onError: () => toast.error('Update failed'),
  });

  const [deductionForm, setDeductionForm] = useState<{ amount: string; deduction_date: string; deduction_type: 'pay_deduction' | 'cash_repayment' | 'manual_adjustment'; notes: string }>({
    amount: '',
    deduction_date: new Date().toISOString().slice(0, 10),
    deduction_type: 'pay_deduction',
    notes: '',
  });

  const addDeduction = useMutation({
    mutationFn: () => addStaffAdvanceDeduction(token!, id, {
      amount: Number(deductionForm.amount),
      deduction_date: deductionForm.deduction_date,
      deduction_type: deductionForm.deduction_type,
      notes: deductionForm.notes,
    }),
    onSuccess: () => {
      toast.success('Deduction added');
      setShowDeduction(false);
      setDeductionForm({ amount: '', deduction_date: new Date().toISOString().slice(0, 10), deduction_type: 'pay_deduction', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['staff-advance', id] });
      queryClient.invalidateQueries({ queryKey: ['staff-advances'] });
    },
    onError: () => toast.error('Failed to add deduction'),
  });

  const deleteDeduction = useMutation({
    mutationFn: (deductionId: number) => removeStaffAdvanceDeduction(token!, id, deductionId),
    onSuccess: () => { toast.success('Deduction removed'); queryClient.invalidateQueries({ queryKey: ['staff-advance', id] }); queryClient.invalidateQueries({ queryKey: ['staff-advances'] }); },
    onError: () => toast.error('Failed to remove deduction'),
  });

  if (isLoading || !advance) {
    return <PageShell title="Staff Advance" icon={HandCoins} description="Loading..."><div className="p-6 text-sm text-muted-foreground">Loading...</div></PageShell>;
  }

  const employeeName = advance.employee?.profiles
    ? `${advance.employee.profiles.first_name || ''} ${advance.employee.profiles.last_name || ''}`.trim()
    : `Employee #${advance.employee_id}`;

  const total = Number(advance.total_amount) || 0;
  const remaining = Number(advance.remaining_balance) || 0;
  const recovered = Math.max(0, total - remaining);
  const pct = total > 0 ? Math.min(100, Math.round((recovered / total) * 100)) : 0;

  return (
    <PageShell
      title={advance.title}
      icon={HandCoins}
      description={`${employeeName} · ${advance.advance_type}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/finance/staff-advances"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
          <Button variant="outline" size="sm" onClick={() => {
            setEditForm({
              title: advance.title,
              description: advance.description || '',
              notes: advance.notes || '',
              total_amount: String(advance.total_amount),
              advance_type: advance.advance_type,
            });
            setShowEdit(true);
          }}><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5" /> Advance Details
            </CardTitle>
            <Badge variant={statusBadge(advance.status)} className="capitalize w-fit">{advance.status.replace('_', ' ')}</Badge>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Employee</span> <span className="font-medium">{employeeName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span> <span className="capitalize">{advance.advance_type}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Advance Date</span> <span>{formatDate(advance.advance_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span> <span>{formatDate(advance.created_at)}</span></div>
              {advance.pay_period_start && advance.pay_period_end && (
                <div className="flex justify-between sm:col-span-2"><span className="text-muted-foreground">Pay Period</span> <span>{formatDate(advance.pay_period_start)} – {formatDate(advance.pay_period_end)}</span></div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t">
              <div><p className="text-xs text-muted-foreground uppercase">Total</p><p className="text-lg font-bold">{formatCurrency(total)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase">Remaining</p><p className="text-lg font-bold">{formatCurrency(remaining)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase">Paid Back</p><p className="text-lg font-bold">{formatCurrency(recovered)}</p></div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Recovery progress</span><span className="font-medium">{pct}%</span></div>
              <Progress value={pct} className="h-2" />
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
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle>Deductions</CardTitle>
          <Button size="sm" onClick={() => setShowDeduction(true)} disabled={advance.status === 'cleared' || advance.status === 'rejected'}><Plus className="mr-1 h-4 w-4" /> Add Deduction</Button>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={[{ key: 'date', label: 'Date' }, { key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount', className: 'text-right' }, { key: 'notes', label: 'Notes' }, { key: 'actions', label: '', className: 'w-[60px]' }]}
            data={advance.deductions ?? []}
            keyExtractor={(d) => d.id}
            emptyText="No deductions recorded."
            renderRow={(d) => [
              <span key="date">{formatDate(d.deduction_date)}</span>,
              <Badge key="type" variant="outline" className="capitalize">{d.deduction_type.replace('_', ' ')}</Badge>,
              <span key="amount" className="text-right font-medium">{formatCurrency(d.amount)}</span>,
              <span key="notes" className="text-sm text-muted-foreground">{d.notes || '-'}</span>,
              <div key="actions" className="flex justify-end">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Remove" onClick={() => deleteDeduction.mutate(d.id)} disabled={deleteDeduction.isPending}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>,
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit Advance</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Title</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editForm.advance_type} onValueChange={(v) => setEditForm((f) => ({ ...f, advance_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="loan">Loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total Amount</Label>
                <Input type="number" step="0.01" value={editForm.total_amount} onChange={(e) => setEditForm((f) => ({ ...f, total_amount: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={() => update.mutate()} disabled={update.isPending || !editForm.title.trim()}>{update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeduction} onOpenChange={setShowDeduction}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Deduction</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" value={deductionForm.amount} onChange={(e) => setDeductionForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={deductionForm.deduction_date} onChange={(e) => setDeductionForm((f) => ({ ...f, deduction_date: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Type</Label>
                <Select value={deductionForm.deduction_type} onValueChange={(v) => setDeductionForm((f) => ({ ...f, deduction_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {deductionTypes.map((t) => <SelectItem key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={deductionForm.notes} onChange={(e) => setDeductionForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeduction(false)}>Cancel</Button>
            <Button onClick={() => addDeduction.mutate()} disabled={addDeduction.isPending || !deductionForm.amount || Number(deductionForm.amount) <= 0}>{addDeduction.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
