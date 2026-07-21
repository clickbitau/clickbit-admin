'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createUser } from '@/lib/api';
import { Plus } from 'lucide-react';

const roles = ['admin', 'manager', 'employee', 'customer', 'agent'];

interface UserFormProps {
  token: string;
  onSuccess?: (user: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function UserForm({ token, onSuccess, onCancel, initial }: UserFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'customer',
    phone: '',
    job_title: '',
    company: '',
    ...initial,
  });

  const mutation = useMutation({
    mutationFn: () => createUser(token, form),
    onSuccess: (data: any) => {
      toast.success('User created');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onSuccess?.(data?.user ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create user'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div><Label>First name</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
      <div><Label>Last name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
      <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
      <div><Label>Role</Label>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <div><Label>Job title</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
      <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.email && form.password && form.first_name && form.last_name && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create User
        </Button>
      </div>
    </div>
  );
}
