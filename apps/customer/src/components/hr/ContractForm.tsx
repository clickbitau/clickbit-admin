'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createContract, fetchEmployees, fetchUsers } from '@/lib/api';
import { Plus } from 'lucide-react';

const employmentTypes = ['full_time', 'part_time', 'casual', 'contractor', 'intern'];
const payFrequencies = ['weekly', 'fortnightly', 'monthly'];

interface ContractFormProps {
  token: string;
  onSuccess?: (contract: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function ContractForm({ token, onSuccess, onCancel, initial }: ContractFormProps) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Record<string, any>>({
    employee_id: '',
    start_date: today,
    end_date: '',
    renewal_date: '',
    employment_type: 'full_time',
    position: '',
    department: '',
    manager_id: '',
    hourly_rate: '',
    salary: '',
    pay_frequency: 'fortnightly',
    currency: 'AUD',
    default_weekly_hours: '38',
    terms_summary: '',
    responsibilities: '',
    notes: '',
    work_address: '',
    work_city: '',
    work_state: '',
    work_country: '',
    work_postcode: '',
    work_timezone: '',
    ...initial,
  });

  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees', 'contract-form'],
    queryFn: () => fetchEmployees(token),
    enabled: !!token,
  });

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['users', 'contract-form'],
    queryFn: () => fetchUsers(token),
    enabled: !!token,
  });

  const employees = employeesData?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => createContract(token, {
      ...form,
      employee_id: String(form.employee_id),
      manager_id: form.manager_id ? String(form.manager_id) : undefined,
      end_date: form.end_date || undefined,
      renewal_date: form.renewal_date || undefined,
    }),
    onSuccess: (data: any) => {
      toast.success('Contract created');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      onSuccess?.(data?.contract ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create contract'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Employee</Label>
        {loadingEmployees ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Select employee</option>
            {employees.map((e: any) => <option key={e.id} value={String(e.id)}>{e.user?.first_name} {e.user?.last_name} ({e.employee_number || e.id})</option>)}
          </select>
        )}
      </div>
      <div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
      <div><Label>End date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
      <div><Label>Renewal date</Label><Input type="date" value={form.renewal_date} onChange={(e) => setForm({ ...form, renewal_date: e.target.value })} /></div>
      <div><Label>Employment type</Label>
        <select value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {employmentTypes.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div><Label>Position</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
      <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
      <div><Label>Manager</Label>
        {loadingUsers ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">None</option>
            {usersData?.users?.map((u: any) => <option key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</option>)}
          </select>
        )}
      </div>
      <div><Label>Salary</Label><Input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
      <div><Label>Hourly rate</Label><Input value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></div>
      <div><Label>Pay frequency</Label>
        <select value={form.pay_frequency} onChange={(e) => setForm({ ...form, pay_frequency: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {payFrequencies.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
      <div><Label>Default weekly hours</Label><Input value={form.default_weekly_hours} onChange={(e) => setForm({ ...form, default_weekly_hours: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Responsibilities</Label><Textarea value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} rows={2} /></div>
      <div className="md:col-span-2"><Label>Terms summary</Label><Textarea value={form.terms_summary} onChange={(e) => setForm({ ...form, terms_summary: e.target.value })} rows={2} /></div>
      <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      <div><Label>Work address</Label><Input value={form.work_address} onChange={(e) => setForm({ ...form, work_address: e.target.value })} /></div>
      <div><Label>City</Label><Input value={form.work_city} onChange={(e) => setForm({ ...form, work_city: e.target.value })} /></div>
      <div><Label>State</Label><Input value={form.work_state} onChange={(e) => setForm({ ...form, work_state: e.target.value })} /></div>
      <div><Label>Postcode</Label><Input value={form.work_postcode} onChange={(e) => setForm({ ...form, work_postcode: e.target.value })} /></div>
      <div><Label>Country</Label><Input value={form.work_country} onChange={(e) => setForm({ ...form, work_country: e.target.value })} /></div>
      <div><Label>Timezone</Label><Input value={form.work_timezone} onChange={(e) => setForm({ ...form, work_timezone: e.target.value })} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.employee_id && form.start_date && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Contract
        </Button>
      </div>
    </div>
  );
}
