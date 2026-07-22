'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDate } from '@/lib/format';
import {
  fetchClickDeployCustomers,
  createClickDeployCustomer,
  updateClickDeployCustomer,
  issueClickDeployCode,
  revealClickDeployCode,
  updateClickDeploySubscription,
  revokeClickDeployCode,
  type ClickDeployCustomer,
  type ClickDeployCode,
} from '@/lib/api';
import {
  Rocket,
  Plus,
  RefreshCw,
  Copy,
  Ban,
  KeyRound,
  CheckCircle,
  XCircle,
  Clock,
  ShieldAlert,
  SlidersHorizontal,
  Pencil,
  Loader2,
  UserPlus,
} from 'lucide-react';

const TIERS = ['FREE', 'PRO', 'ENTERPRISE'];

const EXPIRY_OPTIONS = [
  { value: '30d', label: '30 days' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
  { value: '', label: 'Perpetual' },
];

function statusVariant(status: string) {
  switch (status) {
    case 'activated':
      return 'default';
    case 'active':
      return 'secondary';
    case 'revoked':
      return 'destructive';
    case 'superseded':
      return 'outline';
    default:
      return 'outline';
  }
}

function statusIcon(status: string) {
  if (status === 'activated') return <CheckCircle className="h-3 w-3" />;
  if (status === 'revoked') return <XCircle className="h-3 w-3" />;
  if (status === 'superseded') return <ShieldAlert className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
}

function formatSeen(value: string | null | undefined): string {
  if (!value) return 'never';
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminClickDeployPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', notes: '' });

  const [editCustomer, setEditCustomer] = useState<ClickDeployCustomer | null>(null);
  const [editCustomerForm, setEditCustomerForm] = useState({ name: '', email: '', notes: '' });

  const [issueFor, setIssueFor] = useState<ClickDeployCustomer | null>(null);
  const [issueForm, setIssueForm] = useState({ tier: 'PRO', expiresIn: '1y' });
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  const [editSub, setEditSub] = useState<ClickDeployCode | null>(null);
  const [editSubForm, setEditSubForm] = useState({
    tier: 'PRO',
    expiresIn: '__keep__',
    maxNodes: '',
    maxServices: '',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clickdeploy-customers', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchClickDeployCustomers(token);
    },
    enabled: !!token,
  });

  const customers = data?.customers ?? [];

  const createCustomerMutation = useMutation({
    mutationFn: () => createClickDeployCustomer(token!, addForm),
    onSuccess: () => {
      toast.success('Customer added');
      setAddOpen(false);
      setAddForm({ name: '', email: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['clickdeploy-customers', token] });
    },
    onError: () => toast.error('Failed to add customer'),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: () => updateClickDeployCustomer(token!, editCustomer!.id, editCustomerForm),
    onSuccess: () => {
      toast.success('Customer updated');
      setEditCustomer(null);
      queryClient.invalidateQueries({ queryKey: ['clickdeploy-customers', token] });
    },
    onError: () => toast.error('Failed to update customer'),
  });

  const issueMutation = useMutation({
    mutationFn: () => issueClickDeployCode(token!, { customerId: issueFor!.id, ...issueForm }),
    onSuccess: (res) => {
      setIssuedCode(res.code.code);
      queryClient.invalidateQueries({ queryKey: ['clickdeploy-customers', token] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to issue code'),
  });

  const updateSubMutation = useMutation({
    mutationFn: () =>
      updateClickDeploySubscription(token!, editSub!.id, {
        tier: editSubForm.tier,
        maxNodes: editSubForm.maxNodes === '' ? null : Number(editSubForm.maxNodes),
        maxServices: editSubForm.maxServices === '' ? null : Number(editSubForm.maxServices),
        expiresIn: editSubForm.expiresIn === '__keep__' ? undefined : editSubForm.expiresIn,
      }),
    onSuccess: () => {
      toast.success('Subscription updated');
      setEditSub(null);
      queryClient.invalidateQueries({ queryKey: ['clickdeploy-customers', token] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update subscription'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => revokeClickDeployCode(token!, id),
    onSuccess: () => {
      toast.success('Code revoked');
      queryClient.invalidateQueries({ queryKey: ['clickdeploy-customers', token] });
    },
    onError: () => toast.error('Failed to revoke code'),
  });

  async function handleCopyFull(codeId: number) {
    try {
      const res = await revealClickDeployCode(token!, codeId);
      await navigator.clipboard.writeText(res.code);
      toast.success('Full code copied to clipboard');
    } catch {
      toast.error('Failed to copy code');
    }
  }

  function openEditCustomer(customer: ClickDeployCustomer) {
    setEditCustomer(customer);
    setEditCustomerForm({ name: customer.name, email: customer.email || '', notes: customer.notes || '' });
  }

  function openIssue(customer: ClickDeployCustomer) {
    setIssueFor(customer);
    setIssuedCode(null);
    setIssueForm({ tier: 'PRO', expiresIn: '1y' });
  }

  function openEditSub(code: ClickDeployCode) {
    setEditSub(code);
    setEditSubForm({
      tier: code.tier,
      expiresIn: '__keep__',
      maxNodes: code.maxNodes != null ? String(code.maxNodes) : '',
      maxServices: code.maxServices != null ? String(code.maxServices) : '',
    });
  }

  function closeIssue() {
    setIssueFor(null);
    setIssuedCode(null);
    setIssueForm({ tier: 'PRO', expiresIn: '1y' });
  }

  if (isLoading) {
    return (
      <PageShell title="ClickDeploy" icon={Rocket} description="Issue and track product keys for customer instances.">
        <Skeleton className="h-40 w-full" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="ClickDeploy"
      icon={Rocket}
      description="Issue and track product keys for customers' ClickDeploy instances. Codes are single-use — issuing a new one invalidates the customer's previous code."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-1 h-4 w-4" /> Add Customer
          </Button>
        </>
      }
    >
      {customers.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No customers yet. Add a customer, then issue them a product key.
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {customers.map((customer) => (
          <Card key={customer.id}>
            <CardHeader className="pb-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 -mx-5 -mt-5 border-b">
                <div>
                  <CardTitle className="text-lg">{customer.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {customer.email || 'no email'}
                    {customer.notes ? ` · ${customer.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditCustomer(customer)}>
                    <Pencil className="mr-1 h-4 w-4" /> Edit
                  </Button>
                  <Button size="sm" onClick={() => openIssue(customer)}>
                    <Plus className="mr-1 h-4 w-4" /> Issue Code
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {customer.codes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No codes issued yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="px-3 py-2 font-medium">Code</th>
                        <th className="px-3 py-2 font-medium">Tier</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Instance</th>
                        <th className="px-3 py-2 font-medium">Last seen</th>
                        <th className="px-3 py-2 font-medium">Expires</th>
                        <th className="px-3 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.codes.map((code) => (
                        <tr key={code.id} className="border-b last:border-0">
                          <td className="px-3 py-3 font-mono text-foreground">{code.code}</td>
                          <td className="px-3 py-3">{code.tier}</td>
                          <td className="px-3 py-3">
                            <Badge variant={statusVariant(code.status)} className="gap-1 capitalize">
                              {statusIcon(code.status)}
                              {code.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {code.hostname || (code.instanceId ? code.instanceId.slice(0, 8) : '—')}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{formatSeen(code.lastSeenAt)}</td>
                          <td className="px-3 py-3 text-muted-foreground">{code.expiresAt ? formatDate(code.expiresAt) : 'perpetual'}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyFull(code.id)} title="Copy full code">
                                <Copy className="h-4 w-4" />
                              </Button>
                              {(code.status === 'active' || code.status === 'activated') && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSub(code)} title="Edit subscription">
                                    <SlidersHorizontal className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      if (window.confirm('Revoke this code? The instance using it will become unlicensed.')) {
                                        revokeMutation.mutate(code.id);
                                      }
                                    }}
                                    title="Revoke code"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Customer */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>Create a new ClickDeploy customer before issuing a code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Name *"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <Input
              placeholder="Email"
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
            />
            <Textarea
              placeholder="Notes"
              value={addForm.notes}
              onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!addForm.name.trim()) return toast.error('Name is required');
                createCustomerMutation.mutate();
              }}
              disabled={createCustomerMutation.isPending}
            >
              {createCustomerMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer */}
      <Dialog open={!!editCustomer} onOpenChange={(open) => !open && setEditCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Name *"
              value={editCustomerForm.name}
              onChange={(e) => setEditCustomerForm({ ...editCustomerForm, name: e.target.value })}
            />
            <Input
              placeholder="Email"
              type="email"
              value={editCustomerForm.email}
              onChange={(e) => setEditCustomerForm({ ...editCustomerForm, email: e.target.value })}
            />
            <Textarea
              placeholder="Notes"
              value={editCustomerForm.notes}
              onChange={(e) => setEditCustomerForm({ ...editCustomerForm, notes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditCustomer(null)}>Cancel</Button>
            <Button onClick={() => updateCustomerMutation.mutate()} disabled={updateCustomerMutation.isPending}>
              {updateCustomerMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Pencil className="mr-1 h-4 w-4" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue Code */}
      <Dialog open={!!issueFor} onOpenChange={(open) => !open && closeIssue()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Code</DialogTitle>
            <DialogDescription>{issueFor ? `for ${issueFor.name}` : ''}</DialogDescription>
          </DialogHeader>
          {issuedCode ? (
            <div className="pt-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                Share this code with the customer. It will only be shown in full once — you can re-copy it later from the table.
              </p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
                <code className="flex-1 text-xs font-mono break-all">{issuedCode}</code>
                <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(issuedCode)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-end">
                <Button onClick={closeIssue}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="pt-2 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tier</label>
                <Select value={issueForm.tier} onValueChange={(tier) => setIssueForm({ ...issueForm, tier })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Expiry</label>
                <Select value={issueForm.expiresIn} onValueChange={(expiresIn) => setIssueForm({ ...issueForm, expiresIn })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Issuing a new code invalidates any previous active code for this customer.</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeIssue}>Cancel</Button>
                <Button onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending}>
                  {issueMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}
                  Issue
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Subscription */}
      <Dialog open={!!editSub} onOpenChange={(open) => !open && setEditSub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>The customer keeps the same key — their instance applies the new plan on its next check-in.</DialogDescription>
          </DialogHeader>
          <div className="pt-2 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tier</label>
              <Select value={editSubForm.tier} onValueChange={(tier) => setEditSubForm({ ...editSubForm, tier })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Max nodes</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="tier default"
                  value={editSubForm.maxNodes}
                  onChange={(e) => setEditSubForm({ ...editSubForm, maxNodes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max services</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="tier default"
                  value={editSubForm.maxServices}
                  onChange={(e) => setEditSubForm({ ...editSubForm, maxServices: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expiry</label>
              <Select value={editSubForm.expiresIn} onValueChange={(expiresIn) => setEditSubForm({ ...editSubForm, expiresIn })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">Keep current ({editSub?.expiresAt ? formatDate(editSub.expiresAt) : 'perpetual'})</SelectItem>
                  {EXPIRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditSub(null)}>Cancel</Button>
              <Button onClick={() => updateSubMutation.mutate()} disabled={updateSubMutation.isPending}>
                {updateSubMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <SlidersHorizontal className="mr-1 h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
