'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Briefcase as BriefcaseIcon, Star, Search } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { StatCards } from '@/components/design-system/StatCards';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { fetchAdminServices, fetchAdminServiceStats, updateService, deleteService } from '@/lib/api';
import type { Service } from '@/types/content';

export default function AdminContentServicesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search.trim()) p.search = search.trim();
    if (status !== 'all') p.status = status;
    if (category !== 'all') p.category = category;
    return p;
  }, [search, status, category]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-services', token, params],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminServices(token, params); },
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-services-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminServiceStats(token); },
    enabled: !!token,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    data?.items?.forEach((s) => { if (s.category) set.add(s.category); });
    return Array.from(set).sort();
  }, [data]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Service> }) => updateService(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-services'] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteService(token!, id),
    onSuccess: () => { toast.success('Service deleted'); queryClient.invalidateQueries({ queryKey: ['admin-services'] }); },
  });

  const statCards = [
    { label: 'Total Services', value: stats?.total ?? 0, icon: BriefcaseIcon },
    { label: 'Active', value: stats?.active ?? 0, icon: BriefcaseIcon, accent: 'success' as const },
    { label: 'Inactive', value: stats?.inactive ?? 0, icon: BriefcaseIcon, accent: 'destructive' as const },
    { label: 'Popular', value: stats?.popular ?? 0, icon: Star, accent: 'warning' as const },
  ];

  return (
    <PageShell
      title="Services"
      icon={BriefcaseIcon}
      actions={
        <Button asChild>
          <Link href="/admin/content/services/new"><Plus className="mr-1 h-4 w-4" /> New Service</Link>
        </Button>
      }
    >
      <StatCards cards={statCards} />

      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-3 pt-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services..." className="pl-9" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">All</option>
            <option value="published">Active</option>
            <option value="draft">Inactive</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </CardContent>
      </Card>

      <DataTable
        loading={isLoading}
        emptyText="No services found."
        headers={[
          { key: 'service', label: 'Service' },
          { key: 'category', label: 'Category' },
          { key: 'active', label: 'Active' },
          { key: 'popular', label: 'Popular' },
          { key: 'actions', label: '', className: 'text-right' },
        ]}
        data={data?.items ?? []}
        keyExtractor={(s) => s.id}
        onRowClick={(s) => router.push(`/admin/content/services/${s.id}`)}
        renderRow={(s) => [
          <div key={s.id}>
            <div className="font-medium">{s.name}</div>
            <div className="text-xs text-muted-foreground">/{s.slug}</div>
          </div>,
          <span key="cat" className="text-sm">{s.category || '—'}</span>,
          <Button key="active" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleMutation.mutate({ id: s.id, data: { is_active: !s.is_active } }); }}>
            {s.is_active ? 'Active' : 'Inactive'}
          </Button>,
          <Button key="popular" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleMutation.mutate({ id: s.id, data: { is_popular: !s.is_popular } }); }}>
            {s.is_popular ? 'Popular' : '—'}
          </Button>,
          <div key="actions" className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" asChild><Link href={`/admin/content/services/${s.id}`}>Edit</Link></Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) remove.mutate(s.id); }}>Delete</Button>
          </div>,
        ]}
      />
    </PageShell>
  );
}
