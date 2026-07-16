'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAdminTeamMembers, createTeamMember, deleteTeamMember } from '@/lib/api';
import type { TeamMember } from '@/types/content';

export default function AdminContentTeamPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', role: '', email: '' });
  const { data, isLoading } = useQuery({ queryKey: ['admin-team', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminTeamMembers(token); }, enabled: !!token });

  const add = useMutation({
    mutationFn: () => createTeamMember(token!, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-team', token] }); setForm({ name: '', role: '', email: '' }); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTeamMember(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-team', token] }),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <Card>
          <CardHeader><CardTitle>New Team Member</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="max-w-xs" />
            <Input placeholder="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="max-w-xs" />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="max-w-xs" />
            <Button onClick={() => form.name && form.role && add.mutate()} disabled={add.isPending}>Add</Button>
          </CardContent>
        </Card>
        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <div className="divide-y">
            {data?.map((m: TeamMember) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-sm text-muted-foreground">{m.role}</div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => remove.mutate(m.id)}>Delete</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
