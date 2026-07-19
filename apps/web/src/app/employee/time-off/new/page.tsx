'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { createTimeOff, fetchEmployeeMe } from '@/lib/api';
import { formatLeaveHours } from '@/lib/format';
import { ArrowLeft, Calendar, Plus } from 'lucide-react';
import { toast } from 'sonner';

const leaveTypes = ['annual', 'sick', 'personal', 'unpaid', 'bereavement', 'maternity', 'paternity', 'study', 'jury_duty', 'other'];
const partialDayTypes = ['morning', 'afternoon', 'custom'];

export default function EmployeeNewTimeOffPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    leave_type: 'annual',
    start_date: today,
    end_date: today,
    is_partial_day: false,
    partial_day_type: '',
    partial_start_time: '',
    partial_end_time: '',
    reason: '',
    notes: '',
  });

  const { data: meData, isLoading: loadingMe } = useQuery({
    queryKey: ['employee-me', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeeMe(token);
    },
    enabled: !!token,
  });

  const employee = meData?.data;

  const mutation = useMutation({
    mutationFn: () => createTimeOff(token!, {
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      is_partial_day: !!form.is_partial_day,
      partial_day_type: form.partial_day_type || undefined,
      partial_start_time: form.partial_start_time || undefined,
      partial_end_time: form.partial_end_time || undefined,
      reason: form.reason,
      notes: form.notes,
    }),
    onSuccess: (data: any) => {
      toast.success('Time off request submitted');
      queryClient.invalidateQueries({ queryKey: ['employee-time-off'] });
      const id = data?.data?.id || data?.id || data?.timeOff?.id;
      router.push(id ? `/employee/time-off/${id}` : '/employee/time-off');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to submit request'),
  });

  const balance =
    form.leave_type === 'annual'
      ? employee?.annual_leave_balance
      : form.leave_type === 'sick'
        ? employee?.sick_leave_balance
        : form.leave_type === 'personal'
          ? employee?.personal_leave_balance
          : null;

  const canSubmit = form.start_date && form.end_date && (!form.is_partial_day || (form.partial_start_time && form.partial_end_time));

  return (
    <PageShell
      title="New Time Off Request"
      icon={Calendar}
      description="Submit a leave request."
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/employee/time-off"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      {loadingMe ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="nm-raised lg:col-span-2">
            <CardHeader><CardTitle>Leave Request</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Leave type</Label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm capitalize"
                >
                  {leaveTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 md:col-span-2 text-sm">
                <input
                  type="checkbox"
                  id="partial"
                  checked={form.is_partial_day}
                  onChange={(e) => setForm({ ...form, is_partial_day: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="partial">Partial day</label>
              </div>
              {form.is_partial_day && (
                <>
                  <div>
                    <Label>Partial day type</Label>
                    <select
                      value={form.partial_day_type}
                      onChange={(e) => setForm({ ...form, partial_day_type: e.target.value })}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Select</option>
                      {partialDayTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Partial start time</Label>
                    <Input type="time" value={form.partial_start_time} onChange={(e) => setForm({ ...form, partial_start_time: e.target.value })} />
                  </div>
                  <div>
                    <Label>Partial end time</Label>
                    <Input type="time" value={form.partial_end_time} onChange={(e) => setForm({ ...form, partial_end_time: e.target.value })} />
                  </div>
                </>
              )}
              <div>
                <Label>Start date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>End date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Reason</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={() => canSubmit && mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
                  <Plus className="mr-2 h-4 w-4" /> {mutation.isPending ? 'Submitting…' : 'Submit Request'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="nm-raised h-fit">
            <CardHeader><CardTitle className="text-sm">Leave Balances</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Annual</span> <span>{formatLeaveHours(employee?.annual_leave_balance)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sick</span> <span>{formatLeaveHours(employee?.sick_leave_balance)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Personal</span> <span>{formatLeaveHours(employee?.personal_leave_balance)}</span></div>
              {balance !== null && balance !== undefined && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Selected type balance</p>
                  <p className="text-lg font-semibold mt-1">{formatLeaveHours(balance)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
