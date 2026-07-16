'use client';
import Link from 'next/link';
import { User as UserIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchUsers, createUser, deleteUser } from '@/lib/api';
import type { User } from '@/types/crm';

export default function AdminSettingsUsersPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', role: 'customer' });
  const { data, isLoading } = useQuery({ queryKey: ['admin-users', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchUsers(token); }, enabled: !!token });

  const add = useMutation({
    mutationFn: () => createUser(token!, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users', token] }); setForm({ first_name: '', last_name: '', email: '', password: '', role: 'customer' }); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteUser(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users', token] }),
  });

  const users = data?.data ?? [];
  const statCards = [
    { label: 'Total Users', value: users.length, icon: UserIcon },
    { label: 'Admins', value: users.filter((u: User) => u.role === 'admin').length, icon: UserIcon, accent: 'primary' as const },
    { label: 'Managers', value: users.filter((u: User) => u.role === 'manager').length, icon: UserIcon, accent: 'warning' as const },
    { label: 'Customers', value: users.filter((u: User) => u.role === 'customer').length, icon: UserIcon, accent: 'success' as const },
  ];

  return (
    <PageShell
      title="Users"
      icon={UserIcon}
    >
      <StatCards cards={statCards} />

      <Card>
        <CardHeader><CardTitle>New User</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="max-w-xs" />
          <Input placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="max-w-xs" />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="max-w-xs" />
          <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="max-w-xs" />
          <Input placeholder="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="max-w-xs" />
          <Button onClick={() => form.email && form.password && form.first_name && add.mutate()} disabled={add.isPending}>Add</Button>
        </CardContent>
      </Card>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="divide-y">
          {data?.data?.map((u: User) => (
            <div key={u.id} className="flex items-center justify-between py-2">
              <div>
                <Link href={`/admin/settings/users/${u.id}`} className="font-medium hover:underline">{u.first_name} {u.last_name}</Link>
                <div className="text-sm text-muted-foreground">{u.email} &middot; {u.role} &middot; {u.status}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => remove.mutate(u.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}