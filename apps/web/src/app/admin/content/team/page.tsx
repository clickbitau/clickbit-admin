'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Mail,
  Phone,
  Briefcase,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  User,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ContentListPage } from '@/components/content/ContentListPage';
import { fetchAdminTeamMembers, fetchAdminTeamStats, updateTeamMember, deleteTeamMember } from '@/lib/api';
import type { TeamMember } from '@clickbit/shared/src/content';
import { toast } from 'sonner';

export default function AdminContentTeamPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-team', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminTeamMembers(token); },
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-team-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminTeamStats(token); },
    enabled: !!token,
  });

  const items = data ?? [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TeamMember> }) => updateTeamMember(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-team'] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTeamMember(token!, id),
    onSuccess: () => { toast.success('Team member deleted'); queryClient.invalidateQueries({ queryKey: ['admin-team'] }); },
  });

  const statCards = [
    { label: 'Total Members', value: stats?.total ?? 0, icon: Users },
    { label: 'Active', value: stats?.active ?? 0, icon: CheckCircle2, accent: 'success' as const },
    { label: 'Inactive', value: stats?.inactive ?? 0, icon: XCircle, accent: 'destructive' as const },
  ];

  const filterTabs = [
    { id: 'all', label: 'All', filter: () => true },
    { id: 'active', label: 'Active', filter: (m: TeamMember) => !!m.is_active, activeClassName: 'bg-emerald-600 text-white' },
    { id: 'inactive', label: 'Inactive', filter: (m: TeamMember) => !m.is_active, activeClassName: 'bg-red-600 text-white' },
  ];

  const searchFn = (m: TeamMember, q: string) =>
    (m.name || '').toLowerCase().includes(q) ||
    (m.role || '').toLowerCase().includes(q) ||
    (m.email || '').toLowerCase().includes(q);

  const toggleStatus = (m: TeamMember, e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleMutation.mutate({ id: m.id, data: { is_active: !m.is_active } });
  };

  const handleDelete = (m: TeamMember, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Delete this team member?')) return;
    remove.mutate(m.id);
  };

  const renderGridCard = (m: TeamMember) => (
    <div className="nm-raised rounded-xl overflow-hidden group">
      <div className="p-5 flex items-start gap-4">
        <div className="w-14 h-14 rounded-full nm-raised-sm flex items-center justify-center flex-shrink-0 overflow-hidden bg-muted">
          {m.image ? <img src={m.image} alt={m.name} className="w-full h-full object-cover" /> : <User className="h-6 w-6 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{m.name}</h3>
          <p className="text-sm text-muted-foreground">{m.role}{m.role_label ? ` · ${m.role_label}` : ''}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
            {m.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {m.email}</span>}
            {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {m.phone}</span>}
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${m.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
      </div>
      <div className="flex items-center justify-between px-5 py-3 nm-inset-sm border-t border-transparent">
        <button
          type="button"
          onClick={(e) => toggleStatus(m, e)}
          disabled={toggleMutation.isPending}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${m.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400'}`}
        >
          {m.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {m.is_active ? 'Active' : 'Inactive'}
        </button>
        <div className="flex items-center gap-1">
          <Link href={`/admin/content/team/${m.id}`} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-all">
            <Edit className="h-4 w-4" />
          </Link>
          <button type="button" onClick={(e) => handleDelete(m, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-all">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderTableRow = (m: TeamMember) => [
    <td key="name" className="px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full nm-raised-sm flex items-center justify-center overflow-hidden bg-muted">
          {m.image ? <img src={m.image} alt={m.name} className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div>
          <div className="font-medium">{m.name}</div>
          <div className="text-xs text-muted-foreground">{m.email || 'No email'}</div>
        </div>
      </div>
    </td>,
    <td key="role" className="px-4 py-4 text-sm">{m.role}{m.role_label ? <span className="text-muted-foreground ml-1">({m.role_label})</span> : ''}</td>,
    <td key="active" className="px-4 py-4 text-center">
      <button
        type="button"
        onClick={(e) => toggleStatus(m, e)}
        disabled={toggleMutation.isPending}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${m.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}
      >
        {m.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {m.is_active ? 'Active' : 'Inactive'}
      </button>
    </td>,
    <td key="actions" className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-1">
        <Link href={`/admin/content/team/${m.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-all"><Edit className="h-4 w-4" /></Link>
        <button type="button" onClick={(e) => handleDelete(m, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-all"><Trash2 className="h-4 w-4" /></button>
      </div>
    </td>,
  ];

  return (
    <ContentListPage
      title="Team"
      icon={Briefcase}
      newHref="/admin/content/team/new"
      newLabel="New Member"
      items={items}
      isLoading={isLoading}
      statCards={statCards}
      searchPlaceholder="Search team members..."
      searchFn={searchFn}
      filterTabs={filterTabs}
      tableHeaders={[{ key: 'member', label: 'Member' }, { key: 'role', label: 'Role' }, { key: 'active', label: 'Active', className: 'text-center' }, { key: 'actions', label: '', className: 'text-right' }]}
      renderGridCard={renderGridCard}
      renderTableRow={renderTableRow}
      onRowClick={(m) => router.push(`/admin/content/team/${m.id}`)}
      emptyText="No team members found."
    />
  );
}
