'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAdminServices, createService, deleteService } from '@/lib/api';
import type { Service } from '@/types/content';

export default function AdminContentServicesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', category: '' });
  const { data, isLoading } = useQuery({ queryKey: ['admin-services', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminServices(token); }, enabled: !!token });

  const add = useMutation({
    mutationFn: () => createService(token!, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-services', token] }); setForm({ name: '', description: '', category: '' }); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteService(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-services', token] }),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Services</h1>
        <Card>
          <CardHeader><CardTitle>New Service</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="max-w-xs" />
            <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="max-w-xs" />
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="max-w-md" />
            <Button onClick={() => form.name && add.mutate()} disabled={add.isPending}>Add</Button>
          </CardContent>
        </Card>
        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <div className="divide-y">
            {data?.items?.map((s: Service) => (
              <div key={s.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-sm text-muted-foreground">{s.category} &middot; {s.status}</div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => remove.mutate(s.id)}>Delete</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
