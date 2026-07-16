'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
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
                  <div className="font-medium">{u.first_name} {u.last_name}</div>
                  <div className="text-sm text-muted-foreground">{u.email} &middot; {u.role} &middot; {u.status}</div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => remove.mutate(u.id)}>Delete</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
