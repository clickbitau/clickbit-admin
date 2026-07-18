'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/design-system/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Building2,
  FolderKanban,
  Briefcase,
  ListTodo,
  Receipt,
  Handshake,
  Globe,
  Mail,
  Phone,
  MapPin,
  User,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from 'lucide-react';
import { Company } from '@clickbit/shared';
import type { ValueBreakdownResponse } from '@/types/crm';
import Image from 'next/image';
import { fetchCompanyValueBreakdown, deleteCompany } from '@/lib/api';
import { toast } from 'sonner';

interface CompanyTableProps {
  companies: Company[];
  loading: boolean;
  viewMode?: 'table' | 'grid';
  onChange?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  subscriber: 'Subscriber',
  lead: 'Lead',
  marketing_qualified: 'MQL',
  sales_qualified: 'SQL',
  opportunity: 'Opportunity',
  customer: 'Customer',
  evangelist: 'Evangelist',
  other: 'Other',
  completed: 'Completed',
  internal: 'Internal',
};

function formatCurrency(value: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getStageColor(stage?: string | null) {
  switch (stage) {
    case 'customer':
    case 'evangelist':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'opportunity':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'sales_qualified':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'marketing_qualified':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'lead':
    case 'subscriber':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

const typeConfig: Record<string, { icon: typeof Receipt; color: string; statusColors: Record<string, string> }> = {
  invoice: {
    icon: Receipt,
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    statusColors: { paid: 'bg-emerald-100 text-emerald-700', default: 'bg-gray-100 text-gray-700' },
  },
  deal: {
    icon: Handshake,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    statusColors: { won: 'bg-emerald-100 text-emerald-700', default: 'bg-gray-100 text-gray-700' },
  },
  project: {
    icon: FolderKanban,
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    statusColors: { completed: 'bg-emerald-100 text-emerald-700', default: 'bg-gray-100 text-gray-700' },
  },
};

export function CompanyTable({ companies, loading, viewMode = 'table', onChange }: CompanyTableProps) {
  const router = useRouter();
  const { token } = useAuth();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [breakdowns, setBreakdowns] = useState<Record<number, ValueBreakdownResponse>>({});
  const [loadingBreakdown, setLoadingBreakdown] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCompany(token!, id),
    onSuccess: () => {
      toast.success('Company deleted');
      onChange?.();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete company'),
  });

  async function toggleBreakdown(id: number) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    if (!breakdowns[id] && token) {
      setLoadingBreakdown(id);
      try {
        const data = await fetchCompanyValueBreakdown(token, id);
        setBreakdowns((prev) => ({ ...prev, [id]: data }));
      } finally {
        setLoadingBreakdown(null);
      }
    }
    setExpanded(id);
  }

  function handleDelete(e: React.MouseEvent, company: Company) {
    e.stopPropagation();
    if (window.confirm(`Delete ${company.name}? This cannot be undone.`)) {
      deleteMutation.mutate(company.id);
    }
  }

  function handleEdit(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    router.push(`/admin/crm/companies/${id}`);
  }

  if (loading) {
    return (
      <div className="nm-raised p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (companies.length === 0) {
    return <EmptyState text="No companies found." />;
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {companies.map((company) => {
          const dealsAndProjects = (company.total_deals ?? 0) + (company.total_projects ?? 0);
          const isExpanded = expanded === company.id;
          const breakdown = breakdowns[company.id];
          const showBreakdown = isExpanded && breakdown;

          return (
            <div
              key={company.id}
              className="group nm-raised hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer"
              onClick={() => router.push(`/admin/crm/companies/${company.id}`)}
            >
              <div className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    {company.logo_url ? (
                      <Image
                        src={company.logo_url}
                        alt={company.name}
                        width={56}
                        height={56}
                        unoptimized
                        className="w-14 h-14 object-contain rounded-xl bg-white dark:bg-gray-700 p-2 border border-slate-200 dark:border-gray-600"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                        <Building2 className="h-7 w-7" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">{company.name}</h3>
                    {company.domain && (
                      <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        <Globe className="h-3 w-3" /> {company.domain} <span className="sr-only">opens in new tab</span>
                      </a>
                    )}
                  </div>
                  <Badge variant="secondary" className={`${getStageColor(company.lifecycle_stage)} border-0`}>
                    {STAGE_LABELS[company.lifecycle_stage || ''] || company.lifecycle_stage || '-'}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  {company.contact_person && (
                    <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" /> {company.contact_person}</div>
                  )}
                  {company.industry && (
                    <div className="flex items-center gap-2 text-sm"><Briefcase className="h-4 w-4 text-muted-foreground" /> {company.industry}</div>
                  )}
                  {(company.effective_email || company.email) && (
                    <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /> <span className="truncate">{company.effective_email || company.email}</span></div>
                  )}
                  {(company.effective_phone || company.phone) && (
                    <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /> {company.effective_phone || company.phone}</div>
                  )}
                  {(company.city || company.country) && (
                    <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /> {[company.city, company.country].filter(Boolean).join(', ')}</div>
                  )}
                </div>

                <div className="flex items-center gap-6 pt-4 border-t border-border/50">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleBreakdown(company.id); }}
                    className="text-left group/value"
                    title="Click for value breakdown"
                  >
                    <div className="flex items-center gap-1">
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(Number(company.total_revenue ?? 0))}
                      </p>
                      {loadingBreakdown === company.id ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> : isExpanded ? <ChevronUp className="h-3 w-3 text-emerald-500" /> : <ChevronDown className="h-3 w-3 text-emerald-500 opacity-0 group-hover/value:opacity-100 transition-opacity" />}
                    </div>
                    <p className="text-xs text-muted-foreground">Value</p>
                  </button>
                  <div className="h-10 w-px bg-border/50" />
                  <div className="cursor-pointer hover:opacity-75" onClick={(e) => { e.stopPropagation(); router.push(`/admin/crm/projects?company_id=${company.id}`); }} title="View projects">
                    <p className="text-xl font-bold">{dealsAndProjects}</p>
                    <p className="text-xs text-muted-foreground">Deals & Projects</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={(e) => handleEdit(e, company.id)}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(e, company)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>

              {showBreakdown && breakdown && (
                <div className="border-t border-border/50 bg-muted/30">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                    <h4 className="text-xs font-semibold flex items-center gap-1"><Receipt className="h-3.5 w-3.5 text-emerald-500" /> Value Breakdown</h4>
                    <button onClick={(e) => { e.stopPropagation(); setExpanded(null); }} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  {breakdown.breakdown.length === 0 ? (
                    <div className="text-center py-4 text-xs text-muted-foreground">No value items found.</div>
                  ) : (
                    <div className="divide-y divide-border/50 max-h-64 overflow-auto">
                      {breakdown.breakdown.map((item, i) => {
                        const config = typeConfig[item.type] || typeConfig.invoice;
                        const Icon = config.icon;
                        const statusClass = config.statusColors[item.status?.toLowerCase() || ''] || config.statusColors.default;
                        return (
                          <div key={`${item.type}-${item.id}-${i}`} className="flex items-center justify-between px-4 py-2 hover:bg-muted/50">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`p-1 rounded ${config.color}`}><Icon className="h-3 w-3" /></div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{item.description}</p>
                                <span className={`text-[9px] px-1 py-0.5 rounded ${statusClass}`}>{item.status?.replace('_', ' ') || '—'}</span>
                              </div>
                            </div>
                            <span className="text-xs font-semibold tabular-nums ml-2 flex-shrink-0">{formatCurrency(item.amount, item.currency || 'AUD')}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50/30 dark:bg-emerald-900/10">
                        <span className="text-xs font-semibold">Total Value</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(breakdown.total, breakdown.currency || 'AUD')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="nm-raised overflow-hidden rounded-xl">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/50 hover:bg-transparent">
            <TableHead className="w-[32%]">Company</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Counts</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <TableRow
              key={company.id}
              className="border-b border-border/30 hover:bg-primary/5 cursor-pointer"
              onClick={() => router.push(`/admin/crm/companies/${company.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  {company.logo_url ? (
                    <Image
                      src={company.logo_url}
                      alt={company.name}
                      width={36}
                      height={36}
                      unoptimized
                      className="h-9 w-9 rounded-lg object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate block">{company.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {[company.city, company.country].filter(Boolean).join(', ') || company.domain || '-'}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-gray-700 dark:text-gray-300">{company.industry || '-'}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={`${getStageColor(company.lifecycle_stage)} border-0`}>
                  {STAGE_LABELS[company.lifecycle_stage || ''] || company.lifecycle_stage || '-'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                <button onClick={(e) => { e.stopPropagation(); toggleBreakdown(company.id); }} className="hover:text-primary flex items-center gap-1">
                  {formatCurrency(Number(company.total_revenue ?? 0))}
                  {loadingBreakdown === company.id ? <Loader2 className="h-3 w-3 animate-spin" /> : expanded === company.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-0.5" title="Deals"><Briefcase className="h-3 w-3" /> {company.total_deals ?? 0}</span>
                  <span className="flex items-center gap-0.5" title="Projects"><FolderKanban className="h-3 w-3" /> {company.total_projects ?? 0}</span>
                  <span className="flex items-center gap-0.5" title="Tasks"><ListTodo className="h-3 w-3" /> {company.total_tasks ?? 0}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-gray-900 dark:text-white truncate">{company.effective_email || company.primary_contact?.email || company.email || '-'}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{company.effective_phone || company.phone || ''}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleEdit(e, company.id)}><Edit2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => handleDelete(e, company)} disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {expanded !== null && breakdowns[expanded] && (
        <div className="border-t border-border/50 bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold flex items-center gap-1"><Receipt className="h-4 w-4 text-emerald-500" /> Value Breakdown: {breakdowns[expanded]?.company_name}</h4>
            <button onClick={() => setExpanded(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          {breakdowns[expanded]?.breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No value items found.</p>
          ) : (
            <div className="divide-y divide-border/50 rounded-lg border border-border/50 overflow-hidden">
              {breakdowns[expanded]?.breakdown.map((item, i) => {
                const config = typeConfig[item.type] || typeConfig.invoice;
                const Icon = config.icon;
                const statusClass = config.statusColors[item.status?.toLowerCase() || ''] || config.statusColors.default;
                return (
                  <div key={`${item.type}-${item.id}-${i}`} className="flex items-center justify-between px-4 py-2 bg-background">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1 rounded ${config.color}`}><Icon className="h-3 w-3" /></div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.description}</p>
                        <span className={`text-[10px] px-1 py-0.5 rounded ${statusClass}`}>{item.status?.replace('_', ' ') || '—'}</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums ml-2 flex-shrink-0">{formatCurrency(item.amount, item.currency || 'AUD')}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-4 py-2 bg-emerald-50/30 dark:bg-emerald-900/10">
                <span className="text-sm font-semibold">Total Value</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(breakdowns[expanded]?.total ?? 0, breakdowns[expanded]?.currency || 'AUD')}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
