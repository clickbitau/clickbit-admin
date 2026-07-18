'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, RotateCcw, Undo2, ChevronDown, ChevronUp, Download, User } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchAuditLogs, fetchAuditLogEntityTypes, restoreAuditLog, undoAuditLog, fetchTeam } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { User as UserType } from '@/types/crm';

const ACTION_OPTIONS = ['all', 'create', 'update', 'delete', 'archive', 'restore', 'login', 'logout', 'view'];

type AuditLog = {
  id: string;
  event_time?: string | null;
  created_at?: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  entity_type?: string;
  entity_id?: string;
  actor_id?: number | null;
  actor_type?: string | null;
  ip_address?: string | null;
  changes?: Record<string, unknown> | null;
  previous_state?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export default function AdminSettingsAuditLogsPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [action, setAction] = useState('all');
  const [userId, setUserId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: typesData } = useQuery({
    queryKey: ['audit-log-entity-types', token],
    queryFn: () => fetchAuditLogEntityTypes(token!),
    enabled: !!token,
  });

  const { data: team } = useQuery({
    queryKey: ['team', token],
    queryFn: () => fetchTeam(token!),
    enabled: !!token,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', token, search, entityType, action, userId, from, to, page],
    queryFn: () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 25 };
      if (search.trim()) params.search = search.trim();
      if (entityType !== 'all') params.entity_type = entityType;
      if (action !== 'all') params.action = action;
      if (userId !== 'all') params.user_id = userId;
      if (from) params.from = from;
      if (to) params.to = to;
      return fetchAuditLogs(token, params);
    },
    enabled: !!token,
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreAuditLog(token!, id),
    onSuccess: (res) => { toast(res.success ? 'Restored' : res.message); queryClient.invalidateQueries({ queryKey: ['audit-logs'] }); },
    onError: () => toast.error('Restore failed'),
  });

  const undo = useMutation({
    mutationFn: (id: string) => undoAuditLog(token!, id),
    onSuccess: (res) => { toast(res.success ? 'Undone' : res.message); queryClient.invalidateQueries({ queryKey: ['audit-logs'] }); },
    onError: () => toast.error('Undo failed'),
  });

  const logs = useMemo(() => (data?.data ?? []) as AuditLog[], [data?.data]);
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 25 };
  const entityTypes = (typesData?.data ?? []) as { entity_type: string; count: number }[];

  const usersById = useMemo(() => {
    const map = new Map<number, UserType>();
    (team ?? []).forEach((u) => map.set(u.id, u));
    return map;
  }, [team]);

  const actorName = (log: AuditLog) => {
    if (log.actor_type === 'system' || log.actor_id == null) return 'System';
    const u = usersById.get(log.actor_id);
    if (u) return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
    return `User #${log.actor_id}`;
  };

  return (
    <PageShell title="Audit Logs" icon={Shield} description="Track changes, restores, and user activity">
      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
          <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">All entity types</option>
            {entityTypes.map((t) => <option key={t.entity_type} value={t.entity_type}>{t.entity_type} ({t.count})</option>)}
          </select>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm">
            {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>)}
          </select>
          <select value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">All users</option>
            {Array.from(usersById.values()).map((u) => (
              <option key={u.id} value={u.id}>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</option>
            ))}
          </select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/admin/audit-logs/export?${buildExportQuery({ search, entityType, action, userId, from, to })}`}><Download className="mr-1 h-4 w-4" /> Export</a>
          </Button>
        </CardContent>
      </Card>

      <DataTable
        headers={[{ key: 'time', label: 'Time' }, { key: 'action', label: 'Action' }, { key: 'entity', label: 'Entity' }, { key: 'actor', label: 'Actor' }, { key: 'ip', label: 'IP' }, { key: 'actions', label: '' }]}
        data={logs}
        loading={isLoading}
        keyExtractor={(log: AuditLog) => String(log.id)}
        emptyText="No audit logs found."
        renderRow={(log: AuditLog) => [
          <span key="time" className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(log.event_time || log.created_at)}</span>,
          <ActionBadge key="action" action={log.action} />,
          <div key="entity"><p className="font-medium">{log.entity_type || log.resource_type}</p><p className="text-xs text-muted-foreground">ID: {log.entity_id || log.resource_id}</p></div>,
          <span key="actor" className="text-sm flex items-center gap-1"><User className="h-3 w-3 text-muted-foreground" /> {actorName(log)}</span>,
          <span key="ip" className="text-xs text-muted-foreground">{log.ip_address || '-'}</span>,
          <div key="actions" className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpandedId(expandedId === String(log.id) ? null : String(log.id))}>
              {expandedId === String(log.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {isAdmin && log.action === 'delete' && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => restore.mutate(String(log.id))} title="Restore"><RotateCcw className="h-4 w-4" /></Button>
            )}
            {isAdmin && log.action === 'update' && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => undo.mutate(String(log.id))} title="Undo"><Undo2 className="h-4 w-4" /></Button>
            )}
          </div>,
        ]}
      />

      {expandedId && (
        <ExpandedLog log={logs.find((l) => String(l.id) === expandedId)} />
      )}

      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.pages}
        totalItems={pagination.total}
        onPageChange={setPage}
      />
    </PageShell>
  );
}

function ActionBadge({ action }: { action: string }) {
  const classes = {
    create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    archive: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    restore: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    login: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    logout: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    view: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };
  return <Badge className={cn('capitalize', (classes as any)[action] ?? classes.view)}>{action}</Badge>;
}

function ExpandedLog({ log }: { log?: AuditLog }) {
  if (!log) return null;
  const changes = (log.changes ?? {}) as Record<string, unknown>;
  const previous = (log.previous_state ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(changes), ...Object.keys(previous)])).sort();

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Details for log #{log.id}</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {keys.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Changed to</p>
              <div className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-60 space-y-1">
                {keys.map((k) => <div key={k}><span className="font-medium">{k}:</span> {JSON.stringify(changes[k] ?? null)}</div>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Previous</p>
              <div className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-60 space-y-1">
                {keys.map((k) => <div key={k}><span className="font-medium">{k}:</span> {JSON.stringify(previous[k] ?? null)}</div>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No changed fields recorded.</div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Metadata</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">{JSON.stringify(log.metadata ?? {}, null, 2)}</pre>
        </div>
      </CardContent>
    </Card>
  );
}

function buildExportQuery(filters: Record<string, string>) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.entityType !== 'all') params.set('entity_type', filters.entityType);
  if (filters.action !== 'all') params.set('action', filters.action);
  if (filters.userId !== 'all') params.set('user_id', filters.userId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}
