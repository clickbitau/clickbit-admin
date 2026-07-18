'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { DataTable } from '@/components/design-system/DataTable';
import { FormDialog } from '@/components/design-system/FormDialog';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRealtimeRefresh } from '@/lib/realtime';
import {
  fetchContact,
  fetchAgentClients,
  fetchContactInvoices,
  fetchContactInteractions,
  fetchContactDocuments,
  fetchCompanies,
  updateContact,
  updateAgentCommission,
  logContactInteraction,
  uploadDocument,
  createContactDocument,
  deleteContactDocument,
  assignAgentToCompany,
} from '@/lib/api';
import { formatCurrency, formatDate, getInitials } from '@/lib/format';
import type { CrmContact } from '@/types/crm';
import type { Company } from '@/types/crm';
import type { Invoice, InvoiceListResponse } from '@/types/finance';
import type { AppDocument } from '@/types/documents';
import type { Activity } from '@/types/crm';
import {
  ArrowLeft,
  Headphones,
  User,
  Building2,
  Mail,
  Phone,
  Receipt,
  FileText,
  MessageCircle,
  Percent,
  Settings,
  UploadCloud,
  Eye,
  X,
  Save,
  Camera,
  Search,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

type TabId = 'overview' | 'clients' | 'commission' | 'documents' | 'interactions' | 'invoices';

interface AgentClient extends Company {
  contacts?: CrmContact[];
}

export default function AgentDetailPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => fetchContact(token!, id),
    enabled: !!token && !!id,
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['agent-clients', id],
    queryFn: () => fetchAgentClients(token!, id),
    enabled: !!token && !!id,
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<InvoiceListResponse>({
    queryKey: ['agent-invoices', id],
    queryFn: () => fetchContactInvoices(token!, id),
    enabled: !!token && !!id && activeTab === 'invoices',
  });

  const { data: interactions, isLoading: interactionsLoading } = useQuery<Activity[]>({
    queryKey: ['agent-interactions', id],
    queryFn: () => fetchContactInteractions(token!, id),
    enabled: !!token && !!id && activeTab === 'interactions',
  });

  const { data: documents, isLoading: documentsLoading } = useQuery<AppDocument[]>({
    queryKey: ['agent-documents', id],
    queryFn: () => fetchContactDocuments(token!, id),
    enabled: !!token && !!id && activeTab === 'documents',
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-for-assign'],
    queryFn: () => fetchCompanies(token!, { limit: 500, sortBy: 'name', sortOrder: 'ASC' }),
    enabled: !!token && assignOpen,
  });

  useRealtimeRefresh(['contacts', 'companies', 'documents', 'invoices'], ['agent', id], { enabled: !!id });

  const clients = (clientsData ?? []) as AgentClient[];
  const invoices = invoicesData?.invoices ?? [];

  const totalOwnRevenue = agent?.total_revenue ?? 0;
  const totalClientRevenue = clients.reduce((s, c) => s + Number(c.total_revenue || 0), 0);
  const totalPortfolio = totalOwnRevenue + totalClientRevenue;
  const commissionRate = Number(agent?.commission_rate || 0);
  const commissionDue =
    agent?.commission_type === 'percentage'
      ? totalClientRevenue * (commissionRate / 100)
      : agent?.commission_type === 'fixed_amount'
      ? commissionRate * clients.length
      : 0;

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CrmContact>) => updateContact(token!, id, data),
    onSuccess: () => {
      toast.success('Profile updated');
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = (await uploadDocument(token!, form)) as any;
      return updateContact(token!, id, { avatar_url: res.document?.file_url });
    },
    onSuccess: () => {
      toast.success('Avatar updated');
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const commissionMutation = useMutation({
    mutationFn: (data: { commission_type: 'none' | 'percentage' | 'fixed_amount'; commission_rate: number }) =>
      updateAgentCommission(token!, id, data),
    onSuccess: () => {
      toast.success('Commission updated');
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const logMutation = useMutation({
    mutationFn: (data: { method: string; notes: string; date: string }) => logContactInteraction(token!, id, data),
    onSuccess: () => {
      toast.success('Interaction logged');
      queryClient.invalidateQueries({ queryKey: ['agent-interactions', id] });
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const assignMutation = useMutation({
    mutationFn: (companyId: number) => assignAgentToCompany(token!, companyId, Number(id)),
    onSuccess: () => {
      toast.success('Company assigned');
      queryClient.invalidateQueries({ queryKey: ['agent-clients', id] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['companies-for-assign'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const removeClientMutation = useMutation({
    mutationFn: (companyId: number) => assignAgentToCompany(token!, companyId, null),
    onSuccess: () => {
      toast.success('Company removed');
      queryClient.invalidateQueries({ queryKey: ['agent-clients', id] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['companies-for-assign'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const docUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = (await uploadDocument(token!, form)) as any;
      const doc = res.document;
      return createContactDocument(token!, id, {
        title: doc?.name || file.name,
        file_url: doc?.file_url,
        file_name: doc?.original_name || file.name,
        file_size: doc?.file_size || file.size,
        file_type: doc?.file_type || file.type,
      });
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['agent-documents', id] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => deleteContactDocument(token!, id, docId),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['agent-documents', id] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  if (isLoading) return <PageShell title="Agent" icon={Headphones} description="Loading..."><div className="p-6 text-sm text-muted-foreground">Loading agent...</div></PageShell>;
  if (!agent) return <PageShell title="Agent" icon={Headphones} description="Not found"><div className="p-6 text-sm text-muted-foreground">Agent not found.</div></PageShell>;

  const statCards = [
    { label: 'Total Portfolio', value: formatCurrency(totalPortfolio), icon: TrendingUp as any, accent: 'secondary' as const },
    { label: 'Client Revenue', value: formatCurrency(totalClientRevenue), icon: DollarSign as any, accent: 'success' as const },
    { label: 'Own Revenue', value: formatCurrency(totalOwnRevenue), icon: DollarSign as any, accent: 'success' as const },
    { label: 'Assigned Companies', value: clients.length, icon: Building2 as any, accent: 'primary' as const },
    { label: 'Commission Due', value: formatCurrency(commissionDue), icon: Percent as any, accent: 'warning' as const },
  ];

  const allCompanies = (companiesData as any)?.companies ?? [];
  const unassigned = allCompanies.filter((c: Company) => !c.agent_id);
  const filteredUnassigned = unassigned.filter((c: Company) =>
    [c.name, c.email, c.industry].filter(Boolean).some((v) => String(v).toLowerCase().includes(assignSearch.toLowerCase()))
  );

  return (
    <PageShell
      title={agent.name}
      icon={Headphones}
      description={agent.email || 'Agent detail'}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/crm/agents')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button size="sm" onClick={() => setEditOpen(true)}>Edit Profile</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="relative group shrink-0">
            {agent.avatar_url ? (
              <img src={agent.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover border" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-bold text-white">
                {getInitials(agent.name)}
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Camera className="h-5 w-5" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) avatarMutation.mutate(file);
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <StatusBadge status="agent" />
            </div>
            {(agent.job_title || agent.primary_company?.name || agent.company) && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {agent.job_title ? `${agent.job_title} at ` : ''}
                {agent.primary_company?.name || agent.company || '-'}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {agent.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {agent.email}</span>}
              {agent.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {agent.phone}</span>}
            </div>
          </div>
        </div>
      </div>

      <StatCards cards={statCards} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview"><User className="mr-1 h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="clients"><Building2 className="mr-1 h-4 w-4" /> Clients ({clients.length})</TabsTrigger>
          <TabsTrigger value="commission"><Percent className="mr-1 h-4 w-4" /> Commission</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="mr-1 h-4 w-4" /> Documents</TabsTrigger>
          <TabsTrigger value="interactions"><MessageCircle className="mr-1 h-4 w-4" /> Interactions</TabsTrigger>
          <TabsTrigger value="invoices"><Receipt className="mr-1 h-4 w-4" /> Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Lifecycle Stage" value={<StatusBadge status={agent.lifecycle_stage || '-'} />} />
              <InfoRow label="Commission" value={`${agent.commission_type || 'none'}${agent.commission_type !== 'none' ? ` (${agent.commission_type === 'percentage' ? commissionRate + '%' : '$' + commissionRate + '/client'})` : ''}`} />
              <InfoRow label="Owner" value={agent.owner?.name || '-'} />
              <InfoRow label="Created" value={formatDate(agent.created_at)} />
              <InfoRow label="Last Contacted" value={formatDate(agent.last_contacted_at)} />
              <InfoRow label="Total Interactions" value={agent.contact_count ?? 0} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Assigned Companies ({clients.length})</CardTitle>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                <Building2 className="mr-1 h-4 w-4" /> Assign Company
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                headers={[
                  { key: 'company', label: 'Company' },
                  { key: 'contacts', label: 'Contacts' },
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'stage', label: 'Stage' },
                  { key: 'actions', label: '' },
                ]}
                data={clients}
                keyExtractor={(c) => c.id}
                loading={clientsLoading}
                emptyText="No companies assigned to this agent."
                renderRow={(c) => [
                  <div key="company" className="min-w-[200px]">
                    <Link href={`/admin/crm/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    <p className="text-xs text-muted-foreground">{c.industry || 'No industry'}</p>
                    <p className="text-xs text-muted-foreground">{c.email || '-'}</p>
                  </div>,
                  <div key="contacts" className="flex flex-wrap gap-1">
                    {(c.contacts || []).slice(0, 3).map((contact: CrmContact) => (
                      <Badge key={contact.id} variant="secondary" className="text-xs">
                        <Link href={`/admin/crm/customers/${contact.id}`} className="hover:underline">{contact.name}</Link>
                      </Badge>
                    ))}
                  </div>,
                  <span key="revenue" className="font-medium text-emerald-600">{formatCurrency(c.total_revenue ?? 0)}</span>,
                  <StatusBadge key="stage" status={c.lifecycle_stage || '-'} />,
                  <div key="actions" className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/finance/invoices?company=${c.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeClientMutation.mutate(c.id)} disabled={removeClientMutation.isPending}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>,
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commission">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Commission Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  commissionMutation.mutate({
                    commission_type: String(data.get('commission_type')) as any,
                    commission_rate: Number(data.get('commission_rate') || 0),
                  });
                }}
                className="space-y-4 max-w-xl"
              >
                <div className="grid gap-2">
                  <Label htmlFor="commission_type">Commission Type</Label>
                  <Select name="commission_type" defaultValue={agent.commission_type ?? 'none'}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Commission</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount (per client)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commission_rate">Rate</Label>
                  <Input name="commission_rate" type="number" step="0.1" defaultValue={commissionRate} />
                </div>
                <div className="nm-raised flex items-center justify-between p-4">
                  <span className="text-sm font-medium text-muted-foreground">Derived Payout Calculation</span>
                  <span className="text-2xl font-bold text-amber-500">{formatCurrency(commissionDue)}</span>
                </div>
                <Button type="submit" disabled={commissionMutation.isPending}>Apply Commission Changes</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Agent Documents</CardTitle>
              <div>
                <input
                  ref={docInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) docUploadMutation.mutate(file);
                  }}
                />
                <Button size="sm" onClick={() => docInputRef.current?.click()} disabled={docUploadMutation.isPending}>
                  <UploadCloud className="mr-1 h-4 w-4" /> Upload
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                headers={[
                  { key: 'document', label: 'Document' },
                  { key: 'size', label: 'Size' },
                  { key: 'date', label: 'Uploaded' },
                  { key: 'actions', label: '' },
                ]}
                data={documents ?? []}
                keyExtractor={(d) => d.id}
                loading={documentsLoading}
                emptyText="No documents uploaded yet."
                renderRow={(d) => [
                  <div key="document" className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-lg">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-primary hover:underline">{d.name || d.original_name || 'Document'}</a>
                    </div>
                  </div>,
                  <span key="size" className="text-sm text-muted-foreground">{((d.file_size || 0) / 1024 / 1024).toFixed(2)} MB</span>,
                  <span key="date" className="text-sm text-muted-foreground">{formatDate(d.created_at)}</span>,
                  <div key="actions" className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /></a>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteDocMutation.mutate(d.id)} disabled={deleteDocMutation.isPending}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>,
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interactions">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Log Agent Touch</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    logMutation.mutate({
                      method: String(data.get('method') || 'other'),
                      notes: String(data.get('notes') || ''),
                      date: String(data.get('date')),
                    });
                    (e.target as HTMLFormElement).reset();
                  }}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="method">Method</Label>
                      <Select name="method" defaultValue="email">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone Call</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="date">Date</Label>
                      <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea name="notes" rows={3} placeholder="Discussed portfolio performance..." required />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={logMutation.isPending}>
                      <Save className="mr-1 h-4 w-4" /> Save Log
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interaction History</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  headers={[
                    { key: 'method', label: 'Method' },
                    { key: 'subject', label: 'Subject' },
                    { key: 'notes', label: 'Notes' },
                    { key: 'date', label: 'Date' },
                  ]}
                  data={interactions ?? []}
                  keyExtractor={(i) => i.id}
                  loading={interactionsLoading}
                  emptyText="No interactions found."
                  renderRow={(i) => [
                    <Badge key="method" variant="secondary" className="capitalize">{((i as any).custom_fields?.method) || i.activity_type}</Badge>,
                    <span key="subject" className="text-sm font-medium">{i.subject || '-'}</span>,
                    <p key="notes" className="text-sm text-muted-foreground whitespace-pre-wrap max-w-xs truncate">{i.description || '-'}</p>,
                    <span key="date" className="text-sm text-muted-foreground">{formatDate(i.completed_at || i.created_at)}</span>,
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Direct Agent Invoices ({invoices.length})</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/finance/invoices?customer=${id}`}>View All <ArrowLeft className="ml-1 h-4 w-4 rotate-180" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                headers={[
                  { key: 'number', label: 'Invoice' },
                  { key: 'date', label: 'Date' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'status', label: 'Status' },
                ]}
                data={invoices}
                keyExtractor={(inv) => inv.id}
                loading={invoicesLoading}
                emptyText="No invoices found."
                renderRow={(inv) => [
                  <Link key="number" href={`/admin/finance/invoices/${inv.id}`} className="font-medium hover:underline">Invoice #{inv.invoice_number || inv.package_code || inv.id}</Link>,
                  <span key="date" className="text-sm text-muted-foreground">{formatDate(inv.issue_date || inv.created_at)}</span>,
                  <span key="amount" className="font-medium">{formatCurrency(inv.total_amount ?? 0)}</span>,
                  <StatusBadge key="status" status={inv.status || '-'} />,
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editOpen && (
        <FormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          title="Edit Agent Profile"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            updateMutation.mutate({
              name: String(data.get('name') || ''),
              email: String(data.get('email') || ''),
              phone: String(data.get('phone') || ''),
              company: String(data.get('company') || ''),
              job_title: String(data.get('job_title') || ''),
            });
          }}
          loading={updateMutation.isPending}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input name="name" defaultValue={agent.name} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input name="email" type="email" defaultValue={agent.email || ''} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input name="phone" defaultValue={agent.phone || ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company">Company</Label>
            <Input name="company" defaultValue={agent.company || ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="job_title">Job Title</Label>
            <Input name="job_title" defaultValue={agent.job_title || ''} />
          </div>
        </FormDialog>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign a Company to Portfolio</DialogTitle>
          </DialogHeader>
          <div className="relative my-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search unassigned companies..."
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredUnassigned.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No unassigned matching companies found</div>
            ) : (
              filteredUnassigned.map((c: Company) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div>
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.email || '-'} · {c.industry || '-'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-emerald-600">{formatCurrency(c.total_revenue ?? 0)}</span>
                    <Button size="sm" onClick={() => assignMutation.mutate(c.id)} disabled={assignMutation.isPending}>Assign</Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
