'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, RotateCcw, Undo2, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchAuditLogs, fetchAuditLogEntityTypes, restoreAuditLog, undoAuditLog } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';

const ACTION_OPTIONS = ['all', 'create', 'update', 'delete', 'archive', 'restore', 'login', 'logout', 'view'];

export default function AdminSettingsAuditLogsPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [action, setAction] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: typesData } = useQuery({
    queryKey: ['audit-log-entity-types', token],
    queryFn: () => fetchAuditLogEntityTypes(token!),
    enabled: !!token,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', token, search, entityType, action, from, to, page],
    queryFn: () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 25 };
      if (search.trim()) params.search = search.trim();
      if (entityType !== 'all') params.entity_type = entityType;
      if (action !== 'all') params.action = action;
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

  const logs = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 25 };
  const entityTypes = typesData?.data ?? [];

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
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/admin/audit-logs/export?${buildExportQuery({ search, entityType, action, from, to })}`}><Download className="mr-1 h-4 w-4" /> Export</a>
          </Button>
        </CardContent>
      </Card>

      <DataTable
        headers={[{ key: 'time', label: 'Time' }, { key: 'action', label: 'Action' }, { key: 'entity', label: 'Entity' }, { key: 'actor', label: 'Actor' }, { key: 'ip', label: 'IP' }, { key: 'actions', label: '' }]}
        data={logs}
        loading={isLoading}
        keyExtractor={(log: any) => String(log.id)}
        emptyText="No audit logs found."
        renderRow={(log: any) => [
          <span key="time" className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(log.event_time || log.created_at)}</span>,
          <Badge key="action" variant={actionVariant(log.action)} className="capitalize">{log.action}</Badge>,
          <div key="entity"><p className="font-medium">{log.entity_type || log.resource_type}</p><p className="text-xs text-muted-foreground">ID: {log.entity_id || log.resource_id}</p></div>,
          <span key="actor" className="text-sm">{log.actor_id || '-'}</span>,
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
        <ExpandedLog log={logs.find((l: any) => String(l.id) === expandedId)} />
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

function ExpandedLog({ log }: { log: any }) {
  if (!log) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Details for log #{log.id}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Changes</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-60">{JSON.stringify(log.changes ?? {}, null, 2)}</pre>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Previous State</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-60">{JSON.stringify(log.previous_state ?? {}, null, 2)}</pre>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Metadata</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">{JSON.stringify(log.metadata ?? {}, null, 2)}</pre>
        </div>
      </CardContent>
    </Card>
  );
}

function actionVariant(action: string) {
  switch (action) {
    case 'create': return 'default' as any;
    case 'update': return 'secondary' as any;
    case 'delete': return 'destructive';
    case 'archive': return 'outline';
    default: return 'secondary';
  }
}

function buildExportQuery(filters: Record<string, string>) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.entityType !== 'all') params.set('entity_type', filters.entityType);
  if (filters.action !== 'all') params.set('action', filters.action);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}
