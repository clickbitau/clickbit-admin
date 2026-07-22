'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { DataTable } from '@/components/design-system/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { fetchEmployee, updateEmployee, deleteEmployee, fetchDocumentSignedUrl } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime, formatLeaveHours } from '@/lib/format';
import type { Employee } from '@/types/hr';
import { ArrowLeft, Users, Save, Trash, Clock, FileText, Calendar, Banknote, Briefcase, FileClock, ClipboardList, GraduationCap, Plus, HandCoins, Target } from 'lucide-react';

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

  const handleSave = () => updateMutation.mutate(form);

  const displayName = employee?.user ? `${employee.user.first_name} ${employee.user.last_name}` : `Employee #${id}`;

  const statCards = employee
    ? [
        { label: 'Employment status', value: employee.employment_status || 'active', icon: Users, accent: employee.employment_status === 'active' ? 'success' as const : 'warning' as const },
        { label: 'Hourly rate', value: formatCurrency(employee.hourly_rate ?? undefined), icon: Banknote },
        { label: 'Salary', value: formatCurrency(employee.salary ?? undefined), icon: Banknote },
        { label: 'Annual leave', value: formatLeaveHours(employee.annual_leave_balance), icon: Calendar },
      ]
    : [];

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
        <div className="flex flex-wrap items-center gap-2">
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
        <>
          <StatCards cards={statCards} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="nm-raised">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
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
                      <div><Label>Personal leave</Label><Input type="number" value={form.personal_leave_balance ?? ''} onChange={(e) => setForm({ ...form, personal_leave_balance: Number(e.target.value) })} /></div>
                      <div className="md:col-span-2"><Label>Emergency contact</Label><Input value={form.emergency_contact_name || ''} placeholder="Name" onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} className="mb-2" /><Input value={form.emergency_contact_phone || ''} placeholder="Phone" onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} className="mb-2" /><Input value={form.emergency_contact_relationship || ''} placeholder="Relationship" onChange={(e) => setForm({ ...form, emergency_contact_relationship: e.target.value })} /></div>
                      <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
                    </div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2 text-sm">
                      <p><span className="text-muted-foreground">Position:</span> {employee.position || '—'}</p>
                      <p><span className="text-muted-foreground">Department:</span> {employee.department || '—'}</p>
                      <p><span className="text-muted-foreground">Employment type:</span> {employee.employment_type || '—'}</p>
                      <p><span className="text-muted-foreground">Status:</span> {employee.employment_status || 'active'}</p>
                      <p><span className="text-muted-foreground">Hire date:</span> {formatDate(employee.hire_date)}</p>
                      <p><span className="text-muted-foreground">Hourly rate:</span> {formatCurrency(employee.hourly_rate ?? undefined)}</p>
                      <p><span className="text-muted-foreground">Salary:</span> {formatCurrency(employee.salary ?? undefined)}</p>
                      <p><span className="text-muted-foreground">Pay frequency:</span> {employee.pay_frequency || '—'}</p>
                      <p><span className="text-muted-foreground">Annual leave:</span> {formatLeaveHours(employee.annual_leave_balance)}</p>
                      <p><span className="text-muted-foreground">Sick leave:</span> {formatLeaveHours(employee.sick_leave_balance)}</p>
                      <p><span className="text-muted-foreground">Personal leave:</span> {formatLeaveHours(employee.personal_leave_balance)}</p>
                      <p><span className="text-muted-foreground">Emergency contact:</span> {employee.emergency_contact_name ? `${employee.emergency_contact_name} · ${employee.emergency_contact_phone || ''} · ${employee.emergency_contact_relationship || ''}` : '—'}</p>
                      {employee.notes && <p className="md:col-span-2"><span className="text-muted-foreground">Notes:</span> {employee.notes}</p>}
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-end">
                    <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash className="mr-2 h-4 w-4" /> Delete employee</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader className="flex flex-row flex-wrap items-center gap-2"><Clock className="h-5 w-5 text-primary" /><CardTitle>Time Clock</CardTitle></CardHeader>
                <CardContent>
                  <DataTable<Record<string, unknown>>
                    headers={[{ key: 'in', label: 'Clock In' }, { key: 'out', label: 'Clock Out' }, { key: 'status', label: 'Status' }]}
                    data={employee.timeEntries || []}
                    keyExtractor={(row, i) => String((row as any).id ?? i)}
                    loading={false}
                    emptyText="No time clock entries."
                    renderRow={(row) => [
                      <span key="in">{formatDateTime((row as any).clock_in_time)}</span>,
                      <span key="out">{formatDateTime((row as any).clock_out_time)}</span>,
                      <Badge key="status" variant={(row as any).clock_out_time ? 'outline' : 'default'}>{(row as any).clock_out_time ? 'Closed' : 'Active'}</Badge>,
                    ]}
                  />
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader className="flex flex-row flex-wrap items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /><CardTitle>Contracts</CardTitle></CardHeader>
                <CardContent>
                  <DataTable<Record<string, unknown>>
                    headers={[{ key: 'type', label: 'Type' }, { key: 'start', label: 'Start' }, { key: 'end', label: 'End' }, { key: 'status', label: 'Status' }]}
                    data={employee.contracts || []}
                    keyExtractor={(row, i) => String((row as any).id ?? i)}
                    loading={false}
                    emptyText="No contracts."
                    renderRow={(row) => [
                      <span key="type">{(row as any).contract_type || '—'}</span>,
                      <span key="start">{formatDate((row as any).start_date)}</span>,
                      <span key="end">{formatDate((row as any).end_date)}</span>,
                      <Badge key="status" variant="outline">{(row as any).status || 'draft'}</Badge>,
                    ]}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="nm-raised">
                <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Email:</span> {employee.user?.email || '—'}</p>
                  <p><span className="text-muted-foreground">Phone:</span> {employee.user?.phone || '—'}</p>
                  <p><span className="text-muted-foreground">Address:</span> {employee.address || employee.user?.address || '—'}</p>
                  <p><span className="text-muted-foreground">City:</span> {employee.city || '—'}</p>
                  <p><span className="text-muted-foreground">State:</span> {employee.state || '—'}</p>
                  <p><span className="text-muted-foreground">Country:</span> {employee.country || '—'}</p>
                  <p><span className="text-muted-foreground">Postcode:</span> {employee.postcode || '—'}</p>
                </CardContent>
              </Card>

              <Card className="nm-raised">
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

              <Card className="nm-raised">
                <CardHeader className="flex flex-row flex-wrap items-center gap-2"><Calendar className="h-5 w-5 text-primary" /><CardTitle>Time Off</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {(employee.timeOffRequests || []).length === 0 && <li className="text-muted-foreground">No time off requests.</li>}
                    {(employee.timeOffRequests || []).slice(0, 5).map((row: any) => (
                      <li key={row.id} className="flex items-center justify-between">
                        <span>{row.leave_type}</span>
                        <Badge variant="outline">{row.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader className="flex flex-row flex-wrap items-center gap-2"><Banknote className="h-5 w-5 text-primary" /><CardTitle>Payslips</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {(employee.payslips || []).length === 0 && <li className="text-muted-foreground">No payslips.</li>}
                    {(employee.payslips || []).slice(0, 5).map((row: any) => (
                      <li key={row.id} className="flex items-center justify-between">
                        <span>{formatDate(row.payment_date)}</span>
                        <span className="font-mono">{formatCurrency(row.net_pay ?? row.gross_pay ?? undefined)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader className="flex flex-row flex-wrap items-center gap-2"><FileClock className="h-5 w-5 text-primary" /><CardTitle>Shifts</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {(employee.shifts || []).length === 0 && <li className="text-muted-foreground">No shifts.</li>}
                    {(employee.shifts || []).slice(0, 5).map((row: any) => (
                      <li key={row.id} className="flex items-center justify-between">
                        <span>{formatDate(row.shift_date)} · {row.start_time?.slice(0,5) || ''} - {row.end_time?.slice(0,5) || ''}</span>
                        <Badge variant={row.status === 'confirmed' ? 'default' : 'outline'}>{row.status || 'scheduled'}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader className="flex flex-row flex-wrap items-center gap-2"><HandCoins className="h-5 w-5 text-primary" /><CardTitle>Staff Advances</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {(employee.staffAdvances || []).length === 0 && <li className="text-muted-foreground">No staff advances.</li>}
                    {(employee.staffAdvances || []).slice(0, 5).map((row: any) => (
                      <li key={row.id} className="flex items-center justify-between">
                        <Link href={`/admin/finance/staff-advances/${row.id}`} className="truncate max-w-[200px] hover:underline">{row.title || `Advance #${row.id}`}</Link>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{formatCurrency(row.remaining_balance)} / {formatCurrency(row.total_amount)}</span>
                          <Badge variant="outline">{row.status || 'active'}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader className="flex flex-row flex-wrap items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /><CardTitle>Documents</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {(employee.documents || []).length === 0 && <li className="text-muted-foreground">No documents.</li>}
                    {(employee.documents || []).slice(0, 5).map((row: any) => (
                      <li key={row.id} className="flex items-center justify-between">
                        <span className="truncate max-w-[200px]">{row.document_name || row.title || `Document #${row.id}`}</span>
                        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={async () => {
                          if (!token) return;
                          try {
                            const { url } = await fetchDocumentSignedUrl(token, row.id);
                            window.open(url, '_blank', 'noopener,noreferrer');
                          } catch {
                            toast.error('Failed to open document');
                          }
                        }}>View</Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader className="flex flex-row flex-wrap items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /><CardTitle>Skills & Certifications</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Skills:</span> {Array.isArray(employee.skills) ? employee.skills.join(', ') : employee.skills ? String(employee.skills) : '—'}</p>
                  <p><span className="text-muted-foreground">Certifications:</span> {Array.isArray(employee.certifications) ? employee.certifications.join(', ') : employee.certifications ? String(employee.certifications) : '—'}</p>
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader className="flex flex-row flex-wrap items-center gap-2"><Target className="h-5 w-5 text-primary" /><CardTitle>KPI Scores</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {(employee.kpiScores || []).length === 0 && <li className="text-muted-foreground">No KPI scores.</li>}
                    {(employee.kpiScores || []).slice(0, 6).map((row: any) => (
                      <li key={row.id} className="flex items-center justify-between">
                        <Link href={`/admin/hr/kpi/${row.id}`} className="hover:underline">{row.period || `Score #${row.id}`}</Link>
                        <span className="font-mono">{row.total_score ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader><CardTitle>Manager</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  {employee.manager ? (
                    <p>{employee.manager.first_name} {employee.manager.last_name} · {employee.manager.email}</p>
                  ) : (
                    <p className="text-muted-foreground">No manager assigned.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
