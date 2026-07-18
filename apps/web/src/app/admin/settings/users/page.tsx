'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Plus,
  User as UserIcon,
  Search,
  Mail,
  KeyRound,
  Trash2,
  RefreshCw,
  Crown,
  Users,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { ConfirmDialog } from '@/components/design-system/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchUsers, resendUserWelcome, resetUser2fa, deleteUser } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { User } from '@/types/crm';

const statusOptions = ['', 'active', 'inactive', 'suspended', 'archived'];
const sortOptions = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created' },
  { key: 'last_login', label: 'Last login' },
];

const teamRoles = 'admin,manager,employee,agent';
const customerRoles = 'customer';

export default function AdminSettingsUsersPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'manager';
  const [tab, setTab] = useState<'team' | 'customers'>(isManager ? 'customers' : 'team');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<User | null>(null);

  const roles = tab === 'team' ? teamRoles : customerRoles;

  const buildParams = (limit = 25, pageOverride?: number) => {
    const params: Record<string, string | number> = { page: pageOverride ?? page, limit, sortBy, sortOrder };
    if (search) params.search = search;
    if (status) params.status = status;
    if (!isManager) params.roles = roles;
    return params;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', token, tab, page, search, status, sortBy, sortOrder],
    queryFn: () => {
      if (!token) throw new Error('No token');
      return fetchUsers(token, buildParams());
    },
    enabled: !!token,
  });

  const teamCountQuery = useQuery({
    queryKey: ['admin-users-count', token, 'team'],
    queryFn: () => {
      if (!token) throw new Error('No token');
      return fetchUsers(token, { page: 1, limit: 1, roles: teamRoles });
    },
    enabled: !!token && !isManager,
  });

  const customerCountQuery = useQuery({
    queryKey: ['admin-users-count', token, 'customers'],
    queryFn: () => {
      if (!token) throw new Error('No token');
      return fetchUsers(token, { page: 1, limit: 1, roles: customerRoles });
    },
    enabled: !!token,
  });

  const users = (data?.data ?? []) as User[];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 25, totalPages: 1 };
  const teamTotal = teamCountQuery.data?.meta?.total ?? 0;
  const customerTotal = customerCountQuery.data?.meta?.total ?? 0;
  const activeTotal = users.filter((u) => u.status === 'active').length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const resendMutation = useMutation({
    mutationFn: (id: number) => resendUserWelcome(token!, id),
    onSuccess: () => { toast.success('Welcome email sent'); },
    onError: () => toast.error('Failed to send welcome email'),
  });

  const reset2faMutation = useMutation({
    mutationFn: (id: number) => resetUser2fa(token!, id),
    onSuccess: (res: any) => { toast.success(res?.message || '2FA reset'); },
    onError: () => toast.error('Failed to reset 2FA'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(token!, id),
    onSuccess: () => { toast.success('User deleted'); setDeleting(null); invalidate(); },
    onError: () => toast.error('Failed to delete user'),
  });

  const title = isManager ? 'Customer Management' : 'User Management';
  const description = isManager
    ? `${customerTotal} customers`
    : `${teamTotal + customerTotal} total users · ${teamTotal} team · ${customerTotal} customers`;

  const statCards = [
    { label: 'Total', value: isManager ? customerTotal : teamTotal + customerTotal, icon: UserIcon },
    { label: 'Team', value: teamTotal, icon: Crown, accent: 'primary' as const, onClick: () => { if (!isManager) setTab('team'); } },
    { label: 'Customers', value: customerTotal, icon: Users, accent: 'success' as const, onClick: () => setTab('customers') },
    { label: 'Active', value: activeTotal, icon: RefreshCw, accent: 'secondary' as const },
  ];

  const getStatusBadge = (status?: string) => {
    if (status === 'active') return <Badge variant="default">Active</Badge>;
    if (status === 'inactive') return <Badge variant="secondary">Inactive</Badge>;
    if (status === 'suspended') return <Badge variant="destructive">Suspended</Badge>;
    if (status === 'archived') return <Badge variant="outline">Archived</Badge>;
    return <Badge variant="outline">{status || 'active'}</Badge>;
  };

  const isLocked = (u: User) => !!u.locked_until && new Date(u.locked_until) > new Date();

  return (
    <PageShell
      title={title}
      icon={UserIcon}
      description={description}
      actions={
        <Button asChild>
          <Link href="/admin/settings/users/new">
            <Plus className="mr-1 h-4 w-4" /> Add {isManager ? 'Customer' : 'User'}
          </Link>
        </Button>
      }
    >
      <StatCards cards={statCards} />

      {!isManager && (
        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'team' | 'customers'); setPage(1); }} className="w-full">
          <TabsList>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="sm:max-w-sm"
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {statusOptions.map((s) => <option key={s} value={s}>{s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : 'All statuses'}</option>)}
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
        headers={[
          { key: 'user', label: 'User' },
          { key: 'role', label: 'Role' },
          { key: 'status', label: 'Status' },
          { key: 'last_login', label: 'Last login' },
          { key: 'actions', label: '' },
        ]}
        data={users}
        loading={isLoading}
        emptyText="No users found."
        keyExtractor={(u) => u.id}
        onRowClick={(u) => router.push(`/admin/settings/users/${u.id}`)}
        renderRow={(u) => [
          <div key="user" className="flex items-center gap-3">
            {u.avatar ? (
              <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {u.first_name?.[0] || u.email?.[0] || '?'}
              </div>
            )}
            <div>
              <p className="font-medium">{u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            {!u.email_verified && <Badge variant="outline" className="ml-2">Unverified</Badge>}
            {isLocked(u) && <Badge variant="destructive" className="ml-2">Locked</Badge>}
          </div>,
          <Badge key="role" variant="outline" className="capitalize">{u.role}</Badge>,
          <div key="status">{getStatusBadge(u.status)}</div>,
          <span key="last_login" className="text-sm text-muted-foreground">{u.last_login ? formatDate(u.last_login) : '—'}</span>,
          <div key="actions" className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); resendMutation.mutate(u.id); }} title="Resend welcome email">
              <Mail className="h-3.5 w-3.5" />
            </Button>
            {!isManager && user?.role === 'admin' && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); reset2faMutation.mutate(u.id); }} title="Reset 2FA">
                <KeyRound className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleting(u); }} title="Delete user">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>,
        ]}
      />

      <Pagination
        currentPage={meta.page}
        totalPages={meta.totalPages}
        totalItems={meta.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete user"
        description={deleting ? `Delete ${deleting.first_name || deleting.last_name ? `${deleting.first_name} ${deleting.last_name}`.trim() : deleting.email}? This cannot be undone.` : ''}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Delete"
      />
    </PageShell>
  );
}
