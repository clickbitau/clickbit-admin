'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/design-system/DataTable';
import { PageShell } from '@/components/design-system/PageShell';
import { Pagination } from '@/components/design-system/Pagination';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchContacts, fetchContactStats } from '@/lib/crm-api';
import { formatCurrency } from '@/lib/format';
import type { CrmContact } from '@/types/crm';
import {
  Contact,
  Search,
  X,
  Users,
  Building2,
  Target,
  Plus,
  RefreshCw,
  User,
  Star,
  Mail,
  Phone,
} from 'lucide-react';
import Link from 'next/link';

const STAGE_OPTIONS = [
  { value: 'subscriber', label: 'Subscriber' },
  { value: 'lead', label: 'Lead' },
  { value: 'marketing_qualified', label: 'MQL' },
  { value: 'sales_qualified', label: 'SQL' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'customer', label: 'Customer' },
  { value: 'evangelist', label: 'Evangelist' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'unqualified', 'nurturing', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

function getStageColor(stage?: string | null) {
  switch (stage) {
    case 'customer':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'opportunity':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'sales_qualified':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'marketing_qualified':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'lead':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'subscriber':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getPriorityColor(priority?: string | null) {
  switch (priority) {
    case 'urgent':
    case 'high':
      return 'text-red-600 dark:text-red-400';
    case 'medium':
      return 'text-amber-600 dark:text-amber-400';
    case 'low':
      return 'text-emerald-600 dark:text-emerald-400';
    default:
      return 'text-gray-500 dark:text-gray-400';
  }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ContactsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [lifecycleStage, setLifecycleStage] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const debouncedSearch = useDebounce(search, 300);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 25, sortBy, sortOrder };
    if (debouncedSearch) params.search = debouncedSearch;
    if (lifecycleStage) params.lifecycle_stage = lifecycleStage;
    if (status) params.status = status;
    if (priority) params.priority = priority;
    return params;
  }, [page, debouncedSearch, lifecycleStage, status, priority, sortBy, sortOrder]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['contacts', queryParams],
    queryFn: () => fetchContacts(token!, queryParams),
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['contact-stats'],
    queryFn: () => fetchContactStats(token!),
    enabled: !!token,
  });

  useRealtimeRefresh(['contacts'], ['contacts'], { enabled: !!token });

  const contacts = (data?.contacts ?? []) as CrmContact[];
  const pagination = data?.pagination as { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } | undefined;

  function toggleSort(field: string) {
    if (sortBy === field) setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  }

  function handleStageFilter(stage: string) {
    setLifecycleStage((prev) => (prev === stage ? '' : stage));
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setLifecycleStage('');
    setStatus('');
    setPriority('');
    setPage(1);
  }

  const hasActiveFilters = search || lifecycleStage || status || priority;

  const statCards = [
    { key: 'total', label: 'Total Contacts', value: stats?.total ?? 0, icon: Users, active: false, onClick: () => { setLifecycleStage(''); setPage(1); } },
    { key: 'customers', label: 'Customers', value: stats?.customerCount ?? 0, icon: Building2, active: lifecycleStage === 'customer', onClick: () => handleStageFilter('customer') },
    { key: 'leads', label: 'Leads', value: stats?.leadCount ?? 0, icon: Target, active: lifecycleStage === 'lead', onClick: () => handleStageFilter('lead') },
    { key: 'avgLeadScore', label: 'Avg Lead Score', value: Math.round(stats?.avgLeadScore ?? 0), icon: Star, active: false, onClick: () => {} },
  ];

  return (
    <PageShell
      title="Contacts"
      icon={Contact}
      description="Manage leads, customers, and contact relationships"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link href="/admin/crm/contacts/new"><Plus className="mr-1 h-4 w-4" /> New Contact</Link>
          </Button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={s.onClick}
              className={`nm-raised p-3 text-left transition-all hover:-translate-y-0.5 ${s.active ? 'ring-2 ring-[#1FBBD2]' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</span>
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="nm-raised p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search contacts..."
              className="pl-9 bg-transparent"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={lifecycleStage} onValueChange={(v) => { setLifecycleStage(v); setPage(1); }}>
            <SelectTrigger className="nm-raised-sm bg-transparent">
              <SelectValue placeholder="Lifecycle stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All stages</SelectItem>
              {STAGE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="nm-raised-sm bg-transparent">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
            <SelectTrigger className="nm-raised-sm bg-transparent">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All priorities</SelectItem>
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => toggleSort(sortBy)}>
            {sortOrder === 'ASC' ? 'Asc' : 'Desc'}
          </Button>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">Active filters:</span>
            {search && <FilterChip label={`"${search}"`} onClear={() => setSearch('')} />}
            {lifecycleStage && <FilterChip label={STAGE_OPTIONS.find((s) => s.value === lifecycleStage)?.label || lifecycleStage} onClear={() => setLifecycleStage('')} />}
            {status && <FilterChip label={status} onClear={() => setStatus('')} />}
            {priority && <FilterChip label={priority} onClear={() => setPriority('')} />}
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 underline">Clear all</button>
          </div>
        )}
      </div>

      <DataTable
        headers={[
          { key: 'contact', label: 'Contact', className: 'w-[40%]' },
          { key: 'company', label: 'Company' },
          { key: 'stage', label: 'Stage' },
          { key: 'score', label: 'Score' },
          { key: 'priority', label: 'Priority' },
          { key: 'revenue', label: 'Revenue' },
        ]}
        data={contacts}
        keyExtractor={(c) => c.id}
        loading={isLoading}
        emptyText="No contacts found."
        onRowClick={(c) => router.push(`/admin/crm/contacts/${c.id}`)}
        renderRow={(c) => {
          const stage = STAGE_OPTIONS.find((s) => s.value === c.lifecycle_stage)?.label || c.lifecycle_stage || '-';
          const ownerName = c.owner ? `${c.owner.first_name || ''} ${c.owner.last_name || ''}`.trim() : '';
          return [
            <div key="contact" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {getInitials(c.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" /> {c.email || '-'}</span>
                  {c.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> {c.phone}</span>}
                </div>
                {ownerName && <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5"><User className="h-3 w-3" /> {ownerName}</p>}
              </div>
            </div>,
            <div key="company" className="min-w-0">
              {c.primary_company ? (
                <>
                  <p className="text-sm text-gray-900 dark:text-white truncate">{c.primary_company.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.job_title || '-'}</p>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{c.company || '-'}</span>
              )}
            </div>,
            <span key="stage" className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getStageColor(c.lifecycle_stage)}`}>
              {stage}
            </span>,
            <div key="score" className="flex items-center gap-2">
              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full ${(c.lead_score ?? 0) >= 70 ? 'bg-emerald-500' : (c.lead_score ?? 0) >= 40 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, c.lead_score ?? 0)}%` }} />
              </div>
              <span className="text-xs font-medium tabular-nums text-gray-600 dark:text-gray-400">{c.lead_score ?? 0}</span>
            </div>,
            <span key="priority" className={`text-xs font-medium capitalize ${getPriorityColor(c.priority)}`}>
              {c.priority || '-'}
            </span>,
            <span key="revenue" className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
              {formatCurrency(c.total_revenue ?? 0)}
            </span>,
          ];
        }}
      />

      {pagination && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={setPage}
        />
      )}
    </PageShell>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
      {label}
      <button onClick={onClear} className="hover:text-gray-900 dark:hover:text-gray-100">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
