'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Ticket as TicketIcon, Plus, Trash2, Save, RefreshCw, AlertTriangle, Github, Zap } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  fetchCustomerRepositories,
  createCustomerRepository,
  updateCustomerRepository,
  deleteCustomerRepository,
  fetchTicketQuotas,
  updateTicketQuota,
  fetchCustomersForAutomation,
  fetchAutomationManualReview,
} from '@/lib/api';
import type { CustomerRepository, Ticket, TicketQuota } from '@/types/support';

function customerLabel(c?: { first_name?: string; last_name?: string; email?: string }) {
  if (!c) return 'Unknown';
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
  return name ? `${name} (${c.email})` : c.email;
}

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(cents / 100);
}

export default function AdminTicketAutomationPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [repoForm, setRepoForm] = useState({ profile_id: '', repo_full_name: '', auto_fix_enabled: true, require_approval: true });
  const [quotaForm, setQuotaForm] = useState({ profile_id: '', free_limit: '5', period: 'monthly', price_cents: '5000', currency: 'AUD' });

  const { data: repos, isLoading: reposLoading, refetch: refetchRepos } = useQuery({
    queryKey: ['customer-repositories', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchCustomerRepositories(token); },
    enabled: !!token,
  });

  const { data: quotas, isLoading: quotasLoading, refetch: refetchQuotas } = useQuery({
    queryKey: ['ticket-quotas', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchTicketQuotas(token); },
    enabled: !!token,
  });

  const { data: customers } = useQuery({
    queryKey: ['automation-customers', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchCustomersForAutomation(token); },
    enabled: !!token,
  });

  const { data: manualReview } = useQuery({
    queryKey: ['manual-review', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAutomationManualReview(token); },
    enabled: !!token,
  });

  const defaults = useMemo(() => (quotas?.defaults || { free_limit: 5, period: 'monthly', price_cents: 5000, currency: 'AUD' }) as Record<string, any>, [quotas]);

  const createRepo = useMutation({
    mutationFn: () => createCustomerRepository(token!, {
      profile_id: repoForm.profile_id ? Number(repoForm.profile_id) : undefined,
      repo_full_name: repoForm.repo_full_name,
      auto_fix_enabled: repoForm.auto_fix_enabled,
      require_approval: repoForm.require_approval,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-repositories', token] });
      setRepoForm({ profile_id: '', repo_full_name: '', auto_fix_enabled: true, require_approval: true });
    },
  });

  const updateRepo = useMutation({
    mutationFn: (data: { id: number; body: Partial<CustomerRepository> }) => updateCustomerRepository(token!, data.id, data.body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-repositories', token] }),
  });

  const deleteRepo = useMutation({
    mutationFn: (id: number) => deleteCustomerRepository(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-repositories', token] }),
  });

  const updateQuota = useMutation({
    mutationFn: (data: { profileId: number; body: Partial<TicketQuota> }) => updateTicketQuota(token!, data.profileId, data.body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-quotas', token] }),
  });

  const createQuota = useMutation({
    mutationFn: () => updateTicketQuota(token!, Number(quotaForm.profile_id), {
      free_limit: Number(quotaForm.free_limit),
      period: quotaForm.period,
      price_cents: Number(quotaForm.price_cents),
      currency: quotaForm.currency,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-quotas', token] });
      setQuotaForm({ profile_id: '', free_limit: String(defaults.free_limit), period: defaults.period, price_cents: String(defaults.price_cents), currency: defaults.currency });
    },
  });

  const customerOptions = (customers?.data || []) as { id: number; first_name: string; last_name: string; email: string }[];
  const repoList = (repos?.data || []) as CustomerRepository[];
  const quotaList = (quotas?.data || []) as TicketQuota[];

  return (
    <PageShell
      title="Ticket Automation"
      icon={TicketIcon}
      description="Link customers to repositories, set ticket quotas, and review flagged tickets."
      actions={
        <Button variant="outline" size="sm" onClick={() => { refetchRepos(); refetchQuotas(); }}><RefreshCw className="h-4 w-4" /></Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Github className="h-5 w-5" /> Customer Repositories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 p-4 nm-raised-sm rounded-xl">
            <Input
              placeholder="owner/repo"
              value={repoForm.repo_full_name}
              onChange={(e) => setRepoForm({ ...repoForm, repo_full_name: e.target.value })}
              className="max-w-xs"
            />
            <select
              value={repoForm.profile_id}
              onChange={(e) => setRepoForm({ ...repoForm, profile_id: e.target.value })}
              className="rounded-md border bg-background px-3 py-2 text-sm max-w-xs"
            >
              <option value="">Select customer…</option>
              {customerOptions.map((c) => <option key={c.id} value={c.id}>{customerLabel(c)}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={repoForm.auto_fix_enabled}
                onChange={(e) => setRepoForm({ ...repoForm, auto_fix_enabled: e.target.checked })}
                className="h-4 w-4 rounded border"
              />
              Auto-fix
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={repoForm.require_approval}
                onChange={(e) => setRepoForm({ ...repoForm, require_approval: e.target.checked })}
                className="h-4 w-4 rounded border"
              />
              Require approval
            </label>
            <Button onClick={() => createRepo.mutate()} disabled={!repoForm.repo_full_name || !repoForm.profile_id || createRepo.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Link
            </Button>
          </div>

          {reposLoading ? <Skeleton className="h-24 w-full" /> : (
            <div className="overflow-x-auto">
              {repoList.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground text-xs uppercase border-b">
                    <tr>
                      <th className="py-2">Customer / Company</th>
                      <th>Repository</th>
                      <th>Auto-fix</th>
                      <th>Approval</th>
                      <th className="text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {repoList.map((repo) => (
                      <tr key={repo.id} className="group">
                        <td className="py-3 pr-4">
                          <div className="font-medium">{repo.customer ? customerLabel(repo.customer) : repo.company?.name || 'Unknown'}</div>
                        </td>
                        <td className="pr-4 font-mono text-xs text-muted-foreground">{repo.repo_full_name}</td>
                        <td className="pr-4">
                          <button
                            type="button"
                            onClick={() => updateRepo.mutate({ id: repo.id, body: { auto_fix_enabled: !repo.auto_fix_enabled } })}
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                              repo.auto_fix_enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {repo.auto_fix_enabled ? 'On' : 'Off'}
                          </button>
                        </td>
                        <td className="pr-4">
                          <button
                            type="button"
                            onClick={() => updateRepo.mutate({ id: repo.id, body: { require_approval: !repo.require_approval } })}
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                              repo.require_approval ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {repo.require_approval ? 'Required' : 'Auto-merge'}
                          </button>
                        </td>
                        <td className="text-right">
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteRepo.mutate(repo.id)}><Trash2 className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-muted-foreground text-sm">No repositories linked yet.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Zap className="h-5 w-5" /> Ticket Quotas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 p-4 nm-raised-sm rounded-xl">
            <select
              value={quotaForm.profile_id}
              onChange={(e) => setQuotaForm({ ...quotaForm, profile_id: e.target.value })}
              className="rounded-md border bg-background px-3 py-2 text-sm max-w-xs"
            >
              <option value="">Select customer…</option>
              {customerOptions.map((c) => <option key={c.id} value={c.id}>{customerLabel(c)}</option>)}
            </select>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Free limit</label>
              <Input type="number" min={0} value={quotaForm.free_limit} onChange={(e) => setQuotaForm({ ...quotaForm, free_limit: e.target.value })} className="w-28" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Reset period</label>
              <select value={quotaForm.period} onChange={(e) => setQuotaForm({ ...quotaForm, period: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Extra ticket price</label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} value={quotaForm.price_cents} onChange={(e) => setQuotaForm({ ...quotaForm, price_cents: e.target.value })} className="w-36" />
                <Input value={quotaForm.currency} onChange={(e) => setQuotaForm({ ...quotaForm, currency: e.target.value })} className="w-24" />
              </div>
            </div>
            <Button onClick={() => createQuota.mutate()} disabled={!quotaForm.profile_id || createQuota.isPending}><Plus className="h-4 w-4 mr-1" /> Save</Button>
          </div>

          {quotasLoading ? <Skeleton className="h-24 w-full" /> : (
            <div className="overflow-x-auto">
              {quotaList.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground text-xs uppercase border-b">
                    <tr><th className="py-2">Customer</th><th>Free limit</th><th>Period</th><th>Extra price</th><th></th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {quotaList.map((q) => (
                      <QuotaRow key={q.id ?? q.profile_id} quota={q} onSave={(body) => updateQuota.mutate({ profileId: q.profile_id, body })} />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-muted-foreground text-sm">No custom quotas set — customers use the default ({defaults.free_limit} / {defaults.period}, {formatCurrency(defaults.price_cents, defaults.currency)} per extra).</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-amber-500" /> Flagged for Manual Review</CardTitle>
        </CardHeader>
        <CardContent>
          {manualReview?.data?.length ? (
            <ul className="divide-y">
              {manualReview.data.map((t: Ticket) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{t.ticket_number}</span>
                      <Link href={`/admin/support/${t.id}`} className="hover:underline">{t.subject}</Link>
                    </div>
                    <div className="text-xs text-muted-foreground capitalize mt-0.5">{t.category} · {t.priority}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline">{t.status}</Badge>
                    <Badge variant="secondary">{t.priority}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted-foreground text-sm">No tickets need manual review.</div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function QuotaRow({ quota, onSave }: { quota: TicketQuota; onSave: (data: Partial<TicketQuota>) => void }) {
  const [freeLimit, setFreeLimit] = useState(String(quota.free_limit));
  const [priceCents, setPriceCents] = useState(String(quota.price_cents));
  const [period, setPeriod] = useState(quota.period);
  const [currency, setCurrency] = useState(quota.currency);
  return (
    <tr className="group">
      <td className="py-3 pr-4 font-medium">{quota.customer ? customerLabel(quota.customer) : `Customer ${quota.profile_id}`}</td>
      <td className="pr-4"><Input type="number" min={0} value={freeLimit} onChange={(e) => setFreeLimit(e.target.value)} className="w-24" /></td>
      <td className="pr-4">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </td>
      <td className="pr-4">
        <div className="flex items-center gap-2">
          <Input type="number" min={0} value={priceCents} onChange={(e) => setPriceCents(e.target.value)} className="w-32" />
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-20" />
        </div>
      </td>
      <td className="text-right"><Button size="sm" onClick={() => onSave({ free_limit: Number(freeLimit), price_cents: Number(priceCents), period, currency })}><Save className="h-4 w-4" /></Button></td>
    </tr>
  );
}
