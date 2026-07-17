'use client';

import Link from 'next/link';
import { Plus, User as UserIcon, Search } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchUsers } from '@/lib/api';
import type { User } from '@/types/crm';

const roleOptions = ['', 'admin', 'manager', 'employee', 'customer', 'agent'];
const statusOptions = ['', 'active', 'inactive', 'suspended'];
const sortOptions = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created' },
];

export default function AdminSettingsUsersPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', token, page, search, status, role, sortBy, sortOrder],
    queryFn: () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 25, sortBy, sortOrder };
      if (search) params.search = search;
      if (status) params.status = status;
      if (role) params.roles = role;
      return fetchUsers(token, params);
    },
    enabled: !!token,
  });

  const users = (data?.data ?? []) as User[];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 25, totalPages: 1 };

  const statCards = [
    { label: 'Total Users', value: meta.total, icon: UserIcon },
    { label: 'Admins', value: users.filter((u: User) => u.role === 'admin').length, icon: UserIcon, accent: 'primary' as const },
    { label: 'Managers', value: users.filter((u: User) => u.role === 'manager').length, icon: UserIcon, accent: 'warning' as const },
    { label: 'Customers', value: users.filter((u: User) => u.role === 'customer').length, icon: UserIcon, accent: 'success' as const },
  ];

  return (
    <PageShell
      title="Users"
      icon={UserIcon}
      description="Manage platform users, roles, and permissions."
      actions={<Button asChild><Link href="/admin/settings/users/new"><Plus className="mr-1 h-4 w-4" /> New User</Link></Button>}
    >
      <StatCards cards={statCards} />

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="max-w-sm"
          />
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {roleOptions.map((r) => <option key={r} value={r}>{r ? r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All roles'}</option>)}
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {statusOptions.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All statuses'}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {sortOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
            {sortOrder === 'asc' ? 'Asc' : 'Desc'}
          </Button>
        </CardContent>
      </Card>

      <DataTable<User>
        headers={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' }, { key: 'status', label: 'Status' }, { key: 'created', label: 'Created' }]}
        data={users}
        loading={isLoading}
        emptyText="No users found."
        keyExtractor={(u) => u.id}
        onRowClick={(u) => router.push(`/admin/settings/users/${u.id}`)}
        renderRow={(u) => [
          <span key="name" className="font-medium">{u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}</span>,
          <span key="email" className="text-sm text-muted-foreground">{u.email}</span>,
          <Badge key="role" variant="outline" className="capitalize">{u.role}</Badge>,
          <Badge key="status" variant={u.status === 'active' ? 'default' : 'secondary'}>{u.status || 'active'}</Badge>,
          <span key="created" className="text-sm text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</span>,
        ]}
      />

      <Pagination
        currentPage={meta.page}
        totalPages={meta.totalPages}
        totalItems={meta.total}
        onPageChange={setPage}
      />
    </PageShell>
  );
}
