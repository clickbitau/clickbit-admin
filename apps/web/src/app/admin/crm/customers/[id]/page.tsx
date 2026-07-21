'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormDialog } from '@/components/design-system/FormDialog';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { useRealtimeRefresh } from '@/lib/realtime';
import {
  fetchContact,
  updateContact,
  fetchContactInvoices,
  fetchContactPayments,
  fetchContactProjects,
  fetchContactDeals,
  fetchContactTickets,
  fetchContactDocuments,
  fetchContactInteractions,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ArrowLeft, Building2, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import type { CrmContact, CrmProject, Deal } from '@/types/crm';
import type { Invoice, Payment } from '@/types/finance';
import type { Ticket } from '@/types/support';
import type { AppDocument } from '@/types/documents';

type TabValue = 'overview' | 'projects' | 'deals' | 'invoices' | 'payments' | 'tickets' | 'documents' | 'activity';

export default function CustomerDetailPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const params = useParams();
  const id = String(params.id);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [pages, setPages] = useState<Record<TabValue, number>>({
    overview: 1,
    projects: 1,
    deals: 1,
    invoices: 1,
    payments: 1,
    tickets: 1,
    documents: 1,
    activity: 1,
  });

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchContact(token!, id),
    enabled: !!token && !!id,
  });

  useRealtimeRefresh(['contacts'], ['customer', id], { enabled: !!id });

  const invoiceQuery = useQuery({
    queryKey: ['customer-invoices', id, pages.invoices],
    queryFn: () => fetchContactInvoices(token!, id, { page: pages.invoices, limit: 10 }),
    enabled: !!token && !!id && activeTab === 'invoices',
  });

  const paymentQuery = useQuery({
    queryKey: ['customer-payments', id, pages.payments],
    queryFn: () => fetchContactPayments(token!, id, { page: pages.payments, limit: 10 }),
    enabled: !!token && !!id && activeTab === 'payments',
  });

  const projectQuery = useQuery({
    queryKey: ['customer-projects', id, pages.projects],
    queryFn: () => fetchContactProjects(token!, id, { page: pages.projects, limit: 10 }),
    enabled: !!token && !!id && activeTab === 'projects',
  });

  const dealQuery = useQuery({
    queryKey: ['customer-deals', id, pages.deals],
    queryFn: () => fetchContactDeals(token!, id, { page: pages.deals, limit: 10 }),
    enabled: !!token && !!id && activeTab === 'deals',
  });

  const ticketQuery = useQuery({
    queryKey: ['customer-tickets', id, pages.tickets],
    queryFn: () => fetchContactTickets(token!, id, { page: pages.tickets, limit: 10 }),
    enabled: !!token && !!id && activeTab === 'tickets',
  });

  const documentQuery = useQuery({
    queryKey: ['customer-documents', id, pages.documents],
    queryFn: () => fetchContactDocuments(token!, id),
    enabled: !!token && !!id && activeTab === 'documents',
  });

  const activityQuery = useQuery({
    queryKey: ['customer-activity', id, pages.activity],
    queryFn: () => fetchContactInteractions(token!, id),
    enabled: !!token && !!id && activeTab === 'activity',
  });

  const updateMutation = useMutation({
    mutationFn: (values: Partial<CrmContact>) => updateContact(token!, id, values),
    onSuccess: () => {
      toast.success('Customer updated');
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  function setPage(tab: TabValue, page: number) {
    setPages((prev) => ({ ...prev, [tab]: page }));
  }

  if (isLoading) {
    return (
      <PageShell title="Customer" icon={User} description="Loading...">
        <div className="p-6 text-sm text-muted-foreground">Loading customer...</div>
      </PageShell>
    );
  }

  if (!customer) {
    return (
      <PageShell title="Customer" icon={User} description="Not found">
        <div className="p-6 text-sm text-muted-foreground">Customer not found.</div>
      </PageShell>
    );
  }

  const statCards = [
    { label: 'Total Revenue', value: formatCurrency(customer.total_revenue ?? 0) },
    { label: 'Lead Score', value: customer.lead_score ?? 0 },
    { label: 'Customer Since', value: formatDate(customer.became_customer_at) },
    { label: 'Last Contacted', value: formatDate(customer.last_contacted_at) },
  ];

  return (
    <PageShell
      title={customer.name || 'Customer'}
      icon={User}
      description={customer.email || customer.lifecycle_stage}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/crm/customers"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <Button size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
        </div>
      }
    >
      <CustomerHeader customer={customer} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <Card key={card.label}>
                <CardHeader><CardTitle className="text-sm text-muted-foreground">{card.label}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{card.value}</p></CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Contact Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span> <span>{customer.email || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span> <span>{customer.phone || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Company</span> <span>{customer.primary_company?.name || customer.company || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lifecycle Stage</span> <StatusBadge status={customer.lifecycle_stage} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lead Status</span> <span>{customer.lead_status || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Source</span> <span>{customer.source || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span> <span>{formatDate(customer.created_at)}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Portal Access</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={customer.portalAccess?.hasAccess ? 'active' : 'inactive'} />
                </div>
                {customer.portalAccess?.user && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Linked User</span> <span>{customer.portalAccess.user.email}</span></div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <DataTable
            headers={[
              { key: 'name', label: 'Project' },
              { key: 'status', label: 'Status' },
              { key: 'budget', label: 'Budget' },
              { key: 'due', label: 'Due Date' },
            ]}
            data={projectQuery.data?.projects ?? []}
            keyExtractor={(p: CrmProject) => p.id}
            loading={projectQuery.isLoading}
            renderRow={(p: CrmProject) => [
              <div key="name">
                <Link href={`/admin/crm/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                <p className="text-xs text-muted-foreground">{p.project_number || p.project_type || '-'}</p>
              </div>,
              <StatusBadge key="status" status={p.status} />,
              <span key="budget" className="font-medium">{formatCurrency(Number(p.budget) || 0, p.currency)}</span>,
              <span key="due">{formatDate(p.due_date)}</span>,
            ]}
          />
          {projectQuery.data?.pagination && projectQuery.data.pagination.totalPages > 1 && (
            <Pagination
              currentPage={projectQuery.data.pagination.currentPage}
              totalPages={projectQuery.data.pagination.totalPages}
              totalItems={projectQuery.data.pagination.totalItems}
              onPageChange={(page) => setPage('projects', page)}
            />
          )}
        </TabsContent>

        <TabsContent value="deals" className="space-y-4">
          <DataTable
            headers={[
              { key: 'title', label: 'Deal' },
              { key: 'stage', label: 'Stage' },
              { key: 'value', label: 'Value' },
              { key: 'expected_close', label: 'Expected Close' },
            ]}
            data={dealQuery.data?.deals ?? []}
            keyExtractor={(d: Deal) => d.id}
            loading={dealQuery.isLoading}
            renderRow={(d: Deal) => [
              <div key="title">
                <Link href={`/admin/crm/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                <p className="text-xs text-muted-foreground">{d.deal_number || '-'}</p>
              </div>,
              <span key="stage" className="text-xs">{d.stage?.name || '-'}</span>,
              <span key="value" className="font-medium">{formatCurrency(Number(d.value) || 0, d.currency)}</span>,
              <span key="expected_close">{formatDate(d.expected_close_date)}</span>,
            ]}
          />
          {dealQuery.data?.pagination && dealQuery.data.pagination.totalPages > 1 && (
            <Pagination
              currentPage={dealQuery.data.pagination.currentPage}
              totalPages={dealQuery.data.pagination.totalPages}
              totalItems={dealQuery.data.pagination.totalItems}
              onPageChange={(page) => setPage('deals', page)}
            />
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <DataTable
            headers={[
              { key: 'number', label: 'Invoice' },
              { key: 'status', label: 'Status' },
              { key: 'total', label: 'Total' },
              { key: 'issue_date', label: 'Issued' },
            ]}
            data={invoiceQuery.data?.invoices ?? []}
            keyExtractor={(i: Invoice) => i.id}
            loading={invoiceQuery.isLoading}
            renderRow={(i: Invoice) => [
              <div key="number">
                <Link href={`/admin/finance/invoices/${i.id}`} className="font-medium hover:underline">{i.package_code || i.invoice_number || `#${i.id}`}</Link>
                <p className="text-xs text-muted-foreground">{i.title || '-'}</p>
              </div>,
              <StatusBadge key="status" status={i.status} />,
              <span key="total" className="font-medium">{formatCurrency(Number(i.total_amount) || 0, i.currency)}</span>,
              <span key="issue_date">{formatDate(i.issue_date)}</span>,
            ]}
          />
          {invoiceQuery.data?.pagination && invoiceQuery.data.pagination.pages > 1 && (
            <Pagination
              currentPage={invoiceQuery.data.pagination.page}
              totalPages={invoiceQuery.data.pagination.pages}
              totalItems={invoiceQuery.data.pagination.total}
              onPageChange={(page) => setPage('invoices', page)}
            />
          )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <DataTable
            headers={[
              { key: 'date', label: 'Date' },
              { key: 'method', label: 'Method' },
              { key: 'amount', label: 'Amount' },
              { key: 'status', label: 'Status' },
            ]}
            data={paymentQuery.data?.payments ?? []}
            keyExtractor={(p: Payment) => p.id}
            loading={paymentQuery.isLoading}
            renderRow={(p: Payment) => [
              <span key="date">{formatDate(p.payment_date)}</span>,
              <span key="method" className="capitalize">{p.payment_method || p.payment_provider || '-'}</span>,
              <span key="amount" className="font-medium">{formatCurrency(Number(p.amount) || 0, p.currency)}</span>,
              <StatusBadge key="status" status={p.status} />,
            ]}
          />
          {paymentQuery.data?.pagination && paymentQuery.data.pagination.totalPages > 1 && (
            <Pagination
              currentPage={paymentQuery.data.pagination.currentPage}
              totalPages={paymentQuery.data.pagination.totalPages}
              totalItems={paymentQuery.data.pagination.totalItems}
              onPageChange={(page) => setPage('payments', page)}
            />
          )}
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <DataTable
            headers={[
              { key: 'ticket', label: 'Ticket' },
              { key: 'status', label: 'Status' },
              { key: 'priority', label: 'Priority' },
              { key: 'updated', label: 'Updated' },
            ]}
            data={ticketQuery.data?.tickets ?? []}
            keyExtractor={(t: Ticket) => t.id}
            loading={ticketQuery.isLoading}
            renderRow={(t: Ticket) => [
              <div key="ticket">
                <Link href={`/admin/support/tickets/${t.id}`} className="font-medium hover:underline">{t.ticket_number}</Link>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.subject}</p>
              </div>,
              <StatusBadge key="status" status={t.status} />,
              <StatusBadge key="priority" status={t.priority} />,
              <span key="updated">{formatDate(t.updated_at)}</span>,
            ]}
          />
          {ticketQuery.data?.pagination && ticketQuery.data.pagination.totalPages > 1 && (
            <Pagination
              currentPage={ticketQuery.data.pagination.currentPage}
              totalPages={ticketQuery.data.pagination.totalPages}
              totalItems={ticketQuery.data.pagination.totalItems}
              onPageChange={(page) => setPage('tickets', page)}
            />
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <DataTable
            headers={[
              { key: 'title', label: 'Document' },
              { key: 'category', label: 'Category' },
              { key: 'size', label: 'Size' },
              { key: 'created', label: 'Created' },
            ]}
            data={documentQuery.data ?? []}
            keyExtractor={(d: AppDocument) => d.id}
            loading={documentQuery.isLoading}
            renderRow={(d: AppDocument) => [
              <a key="title" href={d.file_url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{d.name || d.original_name || `Document #${d.id}`}</a>,
              <span key="category" className="capitalize">{d.file_type || d.related_entity_type || '-'}</span>,
              <span key="size">{d.file_size ? `${Math.round(d.file_size / 1024)} KB` : '-'}</span>,
              <span key="created">{formatDate(d.created_at)}</span>,
            ]}
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <div className="space-y-3">
            {activityQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading activity...</div>
            ) : (activityQuery.data ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No activity recorded.</div>
            ) : (
              (activityQuery.data ?? []).map((a) => (
                <Card key={a.id}>
                  <CardContent className="py-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{a.activity_type || 'Activity'}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                    </div>
                    <p className="mt-1">{a.subject}</p>
                    {a.description && <p className="mt-1 text-muted-foreground">{a.description}</p>}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <FormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Customer"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          updateMutation.mutate({
            name: String(data.get('name') ?? ''),
            email: String(data.get('email') ?? ''),
            phone: String(data.get('phone') ?? ''),
            lifecycle_stage: String(data.get('lifecycle_stage') ?? ''),
            lead_status: String(data.get('lead_status') ?? ''),
            lead_score: Number(data.get('lead_score') || 0) || undefined,
          });
        }}
        loading={updateMutation.isPending}
      >
        <div className="grid gap-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={customer.name} required /></div>
        <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={customer.email ?? ''} /></div>
        <div className="grid gap-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" defaultValue={customer.phone ?? ''} /></div>
        <div className="grid gap-2"><Label htmlFor="lifecycle_stage">Lifecycle Stage</Label><Input id="lifecycle_stage" name="lifecycle_stage" defaultValue={customer.lifecycle_stage ?? 'customer'} /></div>
        <div className="grid gap-2"><Label htmlFor="lead_status">Lead Status</Label><Input id="lead_status" name="lead_status" defaultValue={customer.lead_status ?? ''} /></div>
        <div className="grid gap-2"><Label htmlFor="lead_score">Lead Score</Label><Input id="lead_score" name="lead_score" type="number" defaultValue={customer.lead_score ?? 0} /></div>
      </FormDialog>
    </PageShell>
  );
}

function CustomerHeader({ customer }: { customer: CrmContact }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-lg font-bold text-white">
          {customer.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>}
            {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>}
            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {customer.primary_company?.name || customer.company || '-'}</span>
            <StatusBadge status={customer.lifecycle_stage} />
          </div>
        </div>
      </div>
    </div>
  );
}
