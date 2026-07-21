'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  CheckCircle,
  AlertCircle,
  MailX,
  ShieldOff,
  Edit2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Pagination } from '@/components/design-system/Pagination';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { ConfirmDialog } from '@/components/design-system/ConfirmDialog';
import { UserForm } from '@/components/settings/UserForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchUsers, resendUserWelcome, resetUser2fa, deleteUser } from '@/lib/api';
import { useDebounce } from '@/lib/useDebounce';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { User } from '@/types/crm';


const PAGE_SIZE = 20;
const TEAM_ROLES = 'admin,manager,employee,agent';
const CUSTOMER_ROLES = 'customer';

type SortField = 'name' | 'email' | 'status' | 'last_login' | 'created_at';
type SortOrder = 'asc' | 'desc';

const statusOptions = ['', 'active', 'inactive', 'suspended', 'archived'];

function getRoleBadgeClass(role?: string) {
  switch (role) {
    case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'manager': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'employee': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'agent': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'customer': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getRoleIcon(role?: string) {
  switch (role) {
    case 'admin': return <Crown className="h-3 w-3 mr-1" />;
    case 'manager': return <UserIcon className="h-3 w-3 mr-1" />;
    case 'employee': return <Users className="h-3 w-3 mr-1" />;
    case 'agent': return <UserIcon className="h-3 w-3 mr-1" />;
    default: return <UserIcon className="h-3 w-3 mr-1" />;
  }
}

function getStatusBadgeClass(status?: string) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (status === 'suspended') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (status === 'archived') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  if (status === 'inactive') return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
}

function isLocked(u: User) {
  return !!u.locked_until && new Date(u.locked_until) > new Date();
}

function SortButton({
  label,
  field,
  current,
  onSort,
}: {
  label: string;
  field: SortField;
  current: { field: SortField; order: SortOrder };
  onSort: (field: SortField) => void;
}) {
  const active = current.field === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wider ${active ? 'text-primary' : 'text-muted-foreground'} hover:text-foreground`}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );
}

function useUserSection(roles: string, search: string, status: string) {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: SortField; order: SortOrder }>({ field: 'name', order: 'asc' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users', token, roles, search, status, page, sort.field, sort.order],
    queryFn: () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number | boolean> = {
        page,
        limit: PAGE_SIZE,
        roles,
        sortBy: sort.field,
        sortOrder: sort.order,
      };
      if (search) params.search = search;
      if (status) params.status = status;
      return fetchUsers(token, params);
    },
    enabled: !!token,
  });

  const handleSort = (field: SortField) => {
    setSort((prev) => ({ field, order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  return {
    users: (data?.data ?? []) as User[],
    meta: data?.meta ?? { total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 },
    isLoading,
    error,
    refetch,
    page,
    setPage,
    sort,
    handleSort,
  };
}

function UserActions({ u, canReset2fa }: { u: User; canReset2fa: boolean }) {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [deleting, setDeleting] = useState<User | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const resendMutation = useMutation({
    mutationFn: (id: number) => resendUserWelcome(token!, id),
    onSuccess: () => toast.success('Welcome email sent'),
    onError: () => toast.error('Failed to send welcome email'),
  });

  const reset2faMutation = useMutation({
    mutationFn: (id: number) => resetUser2fa(token!, id),
    onSuccess: (res: any) => toast.success(res?.message || '2FA reset'),
    onError: () => toast.error('Failed to reset 2FA'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(token!, id),
    onSuccess: () => { toast.success('User deleted'); setDeleting(null); invalidate(); },
    onError: () => toast.error('Failed to delete user'),
  });

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/admin/settings/users/${u.id}`)} title="Edit user">
        <Edit2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => resendMutation.mutate(u.id)} title="Resend welcome email">
        <Mail className="h-4 w-4" />
      </Button>
      {canReset2fa && u.auth_uid && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => reset2faMutation.mutate(u.id)} title="Reset 2FA">
          <ShieldOff className="h-4 w-4" />
        </Button>
      )}
      {user?.role === 'admin' && u.id !== user.id && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(u)} title="Delete user">
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete user"
        description={deleting ? `Delete ${deleting.first_name || deleting.last_name ? `${deleting.first_name} ${deleting.last_name}`.trim() : deleting.email}? This cannot be undone.` : ''}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Delete"
      />
    </div>
  );
}

function UserTable({
  users,
  sort,
  onSort,
  canReset2fa,
}: {
  users: User[];
  sort: { field: SortField; order: SortOrder };
  onSort: (field: SortField) => void;
  canReset2fa: boolean;
}) {
  return (
    <div className="hidden lg:block overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-6 py-3 text-left"><SortButton label="User" field="name" current={sort} onSort={onSort} /></th>
            <th className="px-6 py-3 text-left"><SortButton label="Role" field="email" current={sort} onSort={onSort} /></th>
            <th className="px-6 py-3 text-left"><SortButton label="Status" field="status" current={sort} onSort={onSort} /></th>
            <th className="px-6 py-3 text-left"><SortButton label="Last login" field="last_login" current={sort} onSort={onSort} /></th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-primary/5 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <PersonAvatar name={u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || `User ${u.id}`} avatar_url={u.avatar} size="md" />
                  <div>
                    <div className="text-sm font-medium">{u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}</div>
                    <div className="text-sm text-muted-foreground">{u.email}</div>
                  </div>
                  {!u.email_verified && <Badge variant="outline">Unverified</Badge>}
                  {isLocked(u) && <Badge variant="destructive">Locked</Badge>}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeClass(u.role)}`}>
                  {getRoleIcon(u.role)}{u.role}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadgeClass(u.status)}`}>
                  {u.status || 'active'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{u.last_login ? formatDate(u.last_login) : '—'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <UserActions u={u} canReset2fa={canReset2fa} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserCard({ u, canReset2fa }: { u: User; canReset2fa: boolean }) {
  return (
    <div className="lg:hidden p-4 border-b border-border last:border-0">
      <div className="flex items-start gap-3 mb-3">
        <PersonAvatar name={u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || `User ${u.id}`} avatar_url={u.avatar} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}</p>
          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${getRoleBadgeClass(u.role)}`}>
              {getRoleIcon(u.role)}{u.role}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${getStatusBadgeClass(u.status)}`}>
              {u.status || 'active'}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          <span title={u.auth_uid ? 'Connected to auth' : 'Not connected to auth'}>{u.auth_uid ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-yellow-600" />}</span>
          <span title={u.email_verified ? 'Email verified' : 'Email not verified'}>{u.email_verified ? <Mail className="h-4 w-4 text-emerald-600" /> : <MailX className="h-4 w-4 text-red-600" />}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{u.last_login ? `Last login ${formatDate(u.last_login)}` : 'Never logged in'}</span>
        <UserActions u={u} canReset2fa={canReset2fa} />
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  count,
  isOpen,
  onToggle,
  gradient,
}: {
  title: string;
  icon: typeof Crown;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  gradient: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-4 text-white rounded-t-lg transition-all ${gradient}`}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <span className="font-semibold text-lg">{title}</span>
        <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-sm">{count}</span>
      </div>
      {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
    </button>
  );
}

function UserSection({
  title,
  icon,
  roles,
  search,
  status,
  canReset2fa,
  isManager,
  defaultOpen = true,
}: {
  title: string;
  icon: typeof Crown;
  roles: string;
  search: string;
  status: string;
  canReset2fa: boolean;
  isManager: boolean;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { users, meta, isLoading, error, refetch, page, setPage, sort, handleSort } = useUserSection(roles, search, status);

  return (
    <div className="mb-6">
      <SectionHeader title={title} icon={icon} count={meta.total} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} gradient={title === 'Team Members' ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-gradient-to-r from-cyan-600 to-blue-600'} />
      {isOpen && (
        <div className="nm-raised rounded-b-lg overflow-hidden border-t-0">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <div className="p-6 text-destructive flex items-center justify-between">
              <span>Failed to load users</span>
              <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          ) : (
            <>
              <UserTable users={users} sort={sort} onSort={handleSort} canReset2fa={canReset2fa} />
              <div className="lg:hidden divide-y divide-border">
                {users.map((u) => <UserCard key={u.id} u={u} canReset2fa={canReset2fa} />)}
                {users.length === 0 && <div className="p-8 text-center text-muted-foreground">No {title.toLowerCase()} found</div>}
              </div>
              {users.length > 0 && (
                <div className="p-3 border-t border-border/50">
                  <Pagination
                    currentPage={meta.page}
                    totalPages={meta.totalPages}
                    totalItems={meta.total}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsUsersPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'manager';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  const teamQuery = useQuery({
    queryKey: ['admin-users-total', token, TEAM_ROLES],
    queryFn: () => {
      if (!token) throw new Error('No token');
      return fetchUsers(token, { page: 1, limit: 1, roles: TEAM_ROLES });
    },
    enabled: !!token && !isManager,
  });

  const customerQuery = useQuery({
    queryKey: ['admin-users-total', token, CUSTOMER_ROLES],
    queryFn: () => {
      if (!token) throw new Error('No token');
      return fetchUsers(token, { page: 1, limit: 1, roles: CUSTOMER_ROLES });
    },
    enabled: !!token,
  });

  const teamTotal = (teamQuery.data?.meta?.total ?? 0) as number;
  const customerTotal = (customerQuery.data?.meta?.total ?? 0) as number;

  const title = isManager ? 'Customer Management' : 'User Management';
  const description = isManager ? `${customerTotal} customers` : `${teamTotal + customerTotal} total users · ${teamTotal} team · ${customerTotal} customers`;

  return (
    <PageShell
      title={title}
      icon={UserIcon}
      description={description}
      actions={
        <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> Add {isManager ? 'Customer' : 'User'}</Button>
      }
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : 'All statuses'}</option>
              ))}
            </select>
          </div>
        </div>

        {!isManager && (
          <UserSection
            title="Team Members"
            icon={Crown}
            roles={TEAM_ROLES}
            search={debouncedSearch}
            status={status}
            canReset2fa={user?.role === 'admin'}
            isManager={isManager}
            defaultOpen
          />
        )}

        <UserSection
          title="Customers"
          icon={Users}
          roles={CUSTOMER_ROLES}
          search={debouncedSearch}
          status={status}
          canReset2fa={user?.role === 'admin'}
          isManager={isManager}
          defaultOpen
        />

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add {isManager ? 'Customer' : 'User'}</DialogTitle>
              <DialogDescription>Create a user profile and account.</DialogDescription>
            </DialogHeader>
            {token && (
              <UserForm
                token={token}
                initial={{ role: isManager ? 'customer' : undefined }}
                onSuccess={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); }}
                onCancel={() => setCreateOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageShell>
  );
}
