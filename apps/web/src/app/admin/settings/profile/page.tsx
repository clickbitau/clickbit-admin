'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchProfile, updateProfile } from '@/lib/api';

export default function AdminSettingsProfilePage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['profile', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchProfile(token); }, enabled: !!token });
  const user = data?.data?.user;
  const [form, setForm] = useState({ first_name: user?.first_name || '', last_name: user?.last_name || '', phone: user?.phone || '', job_title: user?.job_title || '', company: user?.company || '' });

  const save = useMutation({
    mutationFn: () => updateProfile(token!, form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', token] }),
  });

  if (isLoading) return <div className="min-h-screen bg-background p-6"><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <Card>
          <CardHeader><CardTitle>Edit Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <Input placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Job title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
            <Input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
