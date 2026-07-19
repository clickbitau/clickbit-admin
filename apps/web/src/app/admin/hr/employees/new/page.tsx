'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createEmployee, fetchUsers } from '@/lib/api';
import type { Employee } from '@/types/hr';
import type { User } from '@/types/crm';
import { ArrowLeft, Plus, Users } from 'lucide-react';

const employmentTypes = ['full_time', 'part_time', 'casual', 'contractor', 'intern'];
const statuses = ['active', 'on_leave', 'suspended', 'terminated'];
const payFrequencies = ['weekly', 'fortnightly', 'monthly'];

export default function AdminNewEmployeePage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<Employee>>({
    employment_type: 'full_time',
    employment_status: 'active',
    pay_frequency: 'fortnightly',
    currency: 'AUD',
    default_weekly_hours: 38,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', token, 'no-employee'],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchUsers(token, { role: 'employee', limit: 100 });
    },
    enabled: !!token,
  });

  const users: User[] = (usersData?.users ?? usersData?.data ?? []).filter((u: any) => !u.employee);

  const createMutation = useMutation({
    mutationFn: () => createEmployee(token!, form),
    onSuccess: (data: any) => {
      toast.success('Employee created');
      const id = data?.id || data?.data?.id;
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      router.push(id ? `/admin/hr/employees/${id}` : '/admin/hr/employees');
    },
    onError: () => toast.error('Failed to create employee'),
  });

  const setUser = (userId: string) => {
    setForm({ ...form, user_id: userId ? Number(userId) : undefined });
  };

  return (
    <PageShell
      title="New Employee"
      icon={Users}
      description="Create an employee record linked to a user"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/employees"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader><CardTitle>Employee Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Link user</Label>
            <select value={form.user_id || ''} onChange={(e) => setUser(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Select a user without an employee record...</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.email} {u.first_name || u.last_name ? `(${u.first_name || ''} ${u.last_name || ''})` : ''}</option>
              ))}
            </select>
          </div>
          <div><Label>Employee number</Label><Input value={form.employee_number || ''} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} /></div>
          <div><Label>Employment type</Label>
            <select value={form.employment_type || 'full_time'} onChange={(e) => setForm({ ...form, employment_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {employmentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Status</Label>
            <select value={form.employment_status || 'active'} onChange={(e) => setForm({ ...form, employment_status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><Label>Department</Label><Input value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          <div><Label>Position</Label><Input value={form.position || ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div><Label>Manager ID</Label><Input type="number" value={form.manager_id || ''} onChange={(e) => setForm({ ...form, manager_id: e.target.value ? Number(e.target.value) : undefined })} /></div>
          <div><Label>Department ID</Label><Input type="number" value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value ? Number(e.target.value) : undefined })} /></div>
          <div><Label>Hire date</Label><Input type="date" value={form.hire_date || ''} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
          <div><Label>Default weekly hours</Label><Input type="number" value={form.default_weekly_hours ?? ''} onChange={(e) => setForm({ ...form, default_weekly_hours: e.target.value ? Number(e.target.value) : undefined })} /></div>
          <div><Label>Hourly rate</Label><Input type="number" value={form.hourly_rate ?? ''} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value ? Number(e.target.value) : undefined })} /></div>
          <div><Label>Salary</Label><Input type="number" value={form.salary ?? ''} onChange={(e) => setForm({ ...form, salary: e.target.value ? Number(e.target.value) : undefined })} /></div>
          <div><Label>Pay frequency</Label>
            <select value={form.pay_frequency || 'fortnightly'} onChange={(e) => setForm({ ...form, pay_frequency: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {payFrequencies.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div><Label>Currency</Label><Input value={form.currency || 'AUD'} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          <div className="md:col-span-2">
            <Button onClick={() => form.user_id && createMutation.mutate()} disabled={createMutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create Employee
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
