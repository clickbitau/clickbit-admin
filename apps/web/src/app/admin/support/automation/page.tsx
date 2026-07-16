'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function AdminTicketAutomationPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [repoForm, setRepoForm] = useState<{ profile_id?: number; repo_full_name: string; auto_fix_enabled: boolean; require_approval: boolean }>({ repo_full_name: '', auto_fix_enabled: true, require_approval: true });
  const [editingRepo, setEditingRepo] = useState<CustomerRepository | null>(null);

  const { data: repos, isLoading: reposLoading } = useQuery({
    queryKey: ['customer-repositories', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchCustomerRepositories(token); },
    enabled: !!token,
  });

  const { data: quotas, isLoading: quotasLoading } = useQuery({
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

  const createRepo = useMutation({
    mutationFn: () => createCustomerRepository(token!, repoForm),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customer-repositories', token] }); setRepoForm({ repo_full_name: '', auto_fix_enabled: true, require_approval: true }); },
  });

  const updateRepo = useMutation({
    mutationFn: (data: { id: number; body: Partial<CustomerRepository> }) => updateCustomerRepository(token!, data.id, data.body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customer-repositories', token] }); setEditingRepo(null); },
  });

  const deleteRepo = useMutation({
    mutationFn: (id: number) => deleteCustomerRepository(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-repositories', token] }),
  });

  const updateQuota = useMutation({
    mutationFn: (data: { profileId: number; body: Partial<TicketQuota> }) => updateTicketQuota(token!, data.profileId, data.body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-quotas', token] }),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ticket Automation</h1>
          <p className="text-muted-foreground">Manage customer repositories, quotas and manual review.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Customer Repositories</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="owner/repo" value={repoForm.repo_full_name} onChange={(e) => setRepoForm({ ...repoForm, repo_full_name: e.target.value })} className="max-w-xs" />
              <select value={repoForm.profile_id ?? ''} onChange={(e) => setRepoForm({ ...repoForm, profile_id: e.target.value ? Number(e.target.value) : undefined })} className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Select customer</option>
                {customers?.data?.map((c: { id: number; first_name: string; last_name: string; email: string }) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</option>)}
              </select>
              <Button onClick={() => createRepo.mutate()} disabled={!repoForm.repo_full_name || !repoForm.profile_id}>Add</Button>
            </div>
            {reposLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="divide-y">
                {repos?.data?.map((repo: CustomerRepository) => (
                  <div key={repo.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{repo.repo_full_name}</div>
                      <div className="text-sm text-muted-foreground">{repo.customer ? `${repo.customer.first_name} ${repo.customer.last_name}` : 'Unknown'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingRepo(repo)}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteRepo.mutate(repo.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
                {!repos?.data?.length && <div className="text-muted-foreground">No repositories.</div>}
              </div>
            )}
          </CardContent>
        </Card>

        {editingRepo && (
          <EditRepoDialog repo={editingRepo} customers={customers?.data ?? []} onSave={(body) => updateRepo.mutate({ id: editingRepo.id, body })} onClose={() => setEditingRepo(null)} />
        )}

        <Card>
          <CardHeader><CardTitle>Quotas</CardTitle></CardHeader>
          <CardContent>
            {quotasLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="divide-y">
                {quotas?.data?.map((q: TicketQuota) => (
                  <QuotaRow key={q.id ?? q.profile_id} quota={q} onSave={(body) => updateQuota.mutate({ profileId: q.profile_id, body })} />
                ))}
                {!quotas?.data?.length && <div className="text-muted-foreground">No custom quotas.</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Manual Review</CardTitle></CardHeader>
          <CardContent>
            {manualReview?.data?.length ? (
              <div className="divide-y">
                {manualReview.data.map((t: Ticket) => (
                  <div key={t.id} className="py-2">
                    <div className="font-medium">{t.ticket_number}: {t.subject}</div>
                    <div className="text-sm text-muted-foreground">{t.status} &middot; {t.priority}</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-muted-foreground">No tickets awaiting manual review.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EditRepoDialog({ repo, customers, onSave, onClose }: { repo: CustomerRepository; customers: { id: number; first_name: string; last_name: string; email: string }[]; onSave: (data: Partial<CustomerRepository>) => void; onClose: () => void }) {
  const [form, setForm] = useState(repo);
  return (
    <Card className="border-primary">
      <CardHeader><CardTitle>Edit Repository</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input value={form.repo_full_name} onChange={(e) => setForm({ ...form, repo_full_name: e.target.value })} />
        <select value={form.profile_id ?? ''} onChange={(e) => setForm({ ...form, profile_id: e.target.value ? Number(e.target.value) : undefined })} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
          {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</option>)}
        </select>
        <div className="flex gap-2">
          <Button onClick={() => onSave(form)}>Save</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuotaRow({ quota, onSave }: { quota: TicketQuota; onSave: (data: Partial<TicketQuota>) => void }) {
  const [freeLimit, setFreeLimit] = useState(String(quota.free_limit));
  const [priceCents, setPriceCents] = useState(String(quota.price_cents));
  const [period, setPeriod] = useState(quota.period);
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-[200px] font-medium">{quota.customer ? `${quota.customer.first_name} ${quota.customer.last_name}` : `Customer ${quota.profile_id}`}</div>
      <Input type="number" value={freeLimit} onChange={(e) => setFreeLimit(e.target.value)} className="w-24" />
      <Input type="number" value={priceCents} onChange={(e) => setPriceCents(e.target.value)} className="w-32" />
      <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        <option value="weekly">weekly</option>
        <option value="monthly">monthly</option>
      </select>
      <Button size="sm" onClick={() => onSave({ free_limit: Number(freeLimit), price_cents: Number(priceCents), period })}>Save</Button>
    </div>
  );
}
