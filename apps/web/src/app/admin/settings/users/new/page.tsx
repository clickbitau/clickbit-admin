'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createUser } from '@/lib/api';
import { ArrowLeft, Plus, User as UserIcon } from 'lucide-react';

const roles = ['admin', 'manager', 'employee', 'customer', 'agent'];

export default function AdminNewUserPage() {
  const { token } = useAuth();
  const router = useRouter();
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
  });

  const mutation = useMutation({
    mutationFn: () => createUser(token!, form),
    onSuccess: () => {
      toast.success('User created');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      router.push('/admin/settings/users');
    },
    onError: () => toast.error('Failed to create user'),
  });

  return (
    <PageShell
      title="New User"
      icon={UserIcon}
      description="Create a user profile and account"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/settings/users"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>User Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
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
          <div className="md:col-span-2">
            <Button onClick={() => form.email && form.password && form.first_name && form.last_name && mutation.mutate()} disabled={mutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create User
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
