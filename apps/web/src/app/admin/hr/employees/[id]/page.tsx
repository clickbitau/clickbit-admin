'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { fetchEmployee, updateEmployee, deleteEmployee } from '@/lib/api';
import type { Employee } from '@/types/hr';
import { ArrowLeft, Users, Save, Trash } from 'lucide-react';

const employmentTypes = ['full_time', 'part_time', 'contract', 'casual', 'intern'];
const employmentStatuses = ['active', 'inactive', 'terminated', 'on_leave'];
const payFrequencies = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'];

export default function AdminEmployeeDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>({});

  const { data, isLoading, error } = useQuery<Employee>({
    queryKey: ['employee', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployee(token, id);
    },
    enabled: !!token && !!id,
  });

  const employee = data;

  useEffect(() => {
    if (employee) setForm(employee);
  }, [employee]);

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Employee>) => updateEmployee(token!, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', token, id] });
      toast.success('Employee updated');
      setIsEditing(false);
    },
    onError: () => toast.error('Failed to update employee'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEmployee(token!, id),
    onSuccess: () => {
      toast.success('Employee deleted');
      router.push('/admin/hr/employees');
    },
    onError: () => toast.error('Failed to delete employee'),
  });

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const displayName = employee?.user ? `${employee.user.first_name} ${employee.user.last_name}` : `Employee #${id}`;

  if (error) {
    return (
      <PageShell title="Employee" icon={Users} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/hr/employees"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load employee.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={displayName}
      icon={Users}
      description={employee ? `${employee.position || 'No position'} · ${employee.department || 'No department'}` : ''}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/hr/employees"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleSave} disabled={updateMutation.isPending}><Save className="mr-1 h-4 w-4" /> Save</Button>
          )}
        </div>
      }
    >
      {isLoading || !employee ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{displayName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{employee.user?.email} · {employee.employee_number || `EMP-${employee.id}`}</p>
                  </div>
                  <Badge variant={employee.employment_status === 'active' ? 'default' : 'secondary'}>{employee.employment_status || 'active'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditing ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><Label>Position</Label><Input value={form.position || ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
                    <div><Label>Department</Label><Input value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
                    <div><Label>Employee number</Label><Input value={form.employee_number || ''} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} /></div>
                    <div><Label>Employment type</Label>
                      <select value={form.employment_type || ''} onChange={(e) => setForm({ ...form, employment_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                        <option value="">Select...</option>
                        {employmentTypes.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <div><Label>Employment status</Label>
                      <select value={form.employment_status || ''} onChange={(e) => setForm({ ...form, employment_status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                        {employmentStatuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <div><Label>Hire date</Label><Input type="date" value={form.hire_date ? new Date(form.hire_date).toISOString().split('T')[0] : ''} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
                    <div><Label>Hourly rate</Label><Input type="number" value={form.hourly_rate ?? ''} onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })} /></div>
                    <div><Label>Salary</Label><Input type="number" value={form.salary ?? ''} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} /></div>
                    <div><Label>Pay frequency</Label>
                      <select value={form.pay_frequency || ''} onChange={(e) => setForm({ ...form, pay_frequency: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                        <option value="">Select...</option>
                        {payFrequencies.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div><Label>Annual leave</Label><Input type="number" value={form.annual_leave_balance ?? ''} onChange={(e) => setForm({ ...form, annual_leave_balance: Number(e.target.value) })} /></div>
                    <div><Label>Sick leave</Label><Input type="number" value={form.sick_leave_balance ?? ''} onChange={(e) => setForm({ ...form, sick_leave_balance: Number(e.target.value) })} /></div>
                    <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <p><span className="text-muted-foreground">Position:</span> {employee.position || '—'}</p>
                    <p><span className="text-muted-foreground">Department:</span> {employee.department || '—'}</p>
                    <p><span className="text-muted-foreground">Employment type:</span> {employee.employment_type || '—'}</p>
                    <p><span className="text-muted-foreground">Status:</span> {employee.employment_status || 'active'}</p>
                    <p><span className="text-muted-foreground">Hire date:</span> {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : '—'}</p>
                    <p><span className="text-muted-foreground">Hourly rate:</span> {employee.hourly_rate ?? '—'}</p>
                    <p><span className="text-muted-foreground">Salary:</span> {employee.salary ?? '—'}</p>
                    <p><span className="text-muted-foreground">Pay frequency:</span> {employee.pay_frequency || '—'}</p>
                    <p><span className="text-muted-foreground">Annual leave:</span> {employee.annual_leave_balance ?? '—'}</p>
                    <p><span className="text-muted-foreground">Sick leave:</span> {employee.sick_leave_balance ?? '—'}</p>
                    {employee.notes && <p className="md:col-span-2"><span className="text-muted-foreground">Notes:</span> {employee.notes}</p>}
                  </div>
                )}

                <Separator />

                <div className="flex justify-end">
                  <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash className="mr-2 h-4 w-4" /> Delete employee</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Email:</span> {employee.user?.email || '—'}</p>
                <p><span className="text-muted-foreground">Address:</span> {employee.address || '—'}</p>
                <p><span className="text-muted-foreground">City:</span> {employee.city || '—'}</p>
                <p><span className="text-muted-foreground">State:</span> {employee.state || '—'}</p>
                <p><span className="text-muted-foreground">Country:</span> {employee.country || '—'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Banking</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Account name:</span> {employee.bank_account_name || '—'}</p>
                <p><span className="text-muted-foreground">BSB:</span> {employee.bank_bsb || '—'}</p>
                <p><span className="text-muted-foreground">Account number:</span> {employee.bank_account_number || '—'}</p>
                <p><span className="text-muted-foreground">Super fund:</span> {employee.super_fund_name || '—'}</p>
                <p><span className="text-muted-foreground">Super member:</span> {employee.super_member_number || '—'}</p>
                <p><span className="text-muted-foreground">TFN:</span> {employee.tax_file_number || '—'}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
