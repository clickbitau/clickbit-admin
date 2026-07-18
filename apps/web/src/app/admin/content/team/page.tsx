'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Users as UsersIcon, Search } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { StatCards } from '@/components/design-system/StatCards';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { fetchAdminTeamMembers, fetchAdminTeamStats, updateTeamMember, deleteTeamMember } from '@/lib/api';
import type { TeamMember } from '@/types/content';

export default function AdminContentTeamPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search.trim()) p.search = search.trim();
    return p;
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-team', token, params],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminTeamMembers(token); },
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-team-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminTeamStats(token); },
    enabled: !!token,
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((m) => (m.name || '').toLowerCase().includes(q) || (m.role || '').toLowerCase().includes(q));
    }
    if (active !== 'all') {
      rows = rows.filter((m) => (active === 'active' ? m.is_active : !m.is_active));
    }
    return rows;
  }, [data, search, active]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TeamMember> }) => updateTeamMember(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-team'] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTeamMember(token!, id),
    onSuccess: () => { toast.success('Team member deleted'); queryClient.invalidateQueries({ queryKey: ['admin-team'] }); },
  });

  const statCards = [
    { label: 'Total Members', value: stats?.total ?? 0, icon: UsersIcon },
    { label: 'Active', value: stats?.active ?? 0, icon: UsersIcon, accent: 'success' as const },
    { label: 'Inactive', value: stats?.inactive ?? 0, icon: UsersIcon, accent: 'destructive' as const },
  ];

  return (
    <PageShell
      title="Team"
      icon={UsersIcon}
      actions={
        <Button asChild>
          <Link href="/admin/content/team/new"><Plus className="mr-1 h-4 w-4" /> New Member</Link>
        </Button>
      }
    >
      <StatCards cards={statCards} />

      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-3 pt-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team..." className="pl-9" />
          </div>
          <select value={active} onChange={(e) => setActive(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </CardContent>
      </Card>

      <DataTable
        loading={isLoading}
        emptyText="No team members found."
        headers={[
          { key: 'member', label: 'Member' },
          { key: 'role', label: 'Role' },
          { key: 'active', label: 'Active' },
          { key: 'actions', label: '', className: 'text-right' },
        ]}
        data={filtered}
        keyExtractor={(m) => m.id}
        onRowClick={(m) => router.push(`/admin/content/team/${m.id}`)}
        renderRow={(m) => [
          <div key={m.id}>
            <div className="font-medium">{m.name}</div>
            <div className="text-xs text-muted-foreground">{m.email || 'No email'}</div>
          </div>,
          <span key="role" className="text-sm">{m.role}</span>,
          <Button key="active" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleMutation.mutate({ id: m.id, data: { is_active: !m.is_active } }); }}>
            {m.is_active ? 'Active' : 'Inactive'}
          </Button>,
          <div key="actions" className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" asChild><Link href={`/admin/content/team/${m.id}`}>Edit</Link></Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) remove.mutate(m.id); }}>Delete</Button>
          </div>,
        ]}
      />
    </PageShell>
  );
}
