'use client';

import { PageShell } from '@/components/design-system/PageShell';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/design-system/DataTable';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { useRealtimeRefresh } from '@/lib/realtime';
import {
  fetchCompany,
  fetchCompanyUsers,
  fetchCompanyInvoices,
  fetchCompanyPayments,
  fetchCompanyDocuments,
  fetchCompanyValueBreakdown,
  fetchCompanyContacts,
  fetchCompanyDeals,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Company } from '@/types/crm';
import { ArrowLeft, Building2, Mail, Phone, MapPin, Globe, User, Target } from 'lucide-react';

export default function CompanyDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = String(params.id);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => fetchCompany(token!, id),
    enabled: !!token && !!id,
  });

  useRealtimeRefresh(
    ['companies', 'contacts', 'deals', 'invoices', 'payments', 'documents'],
    ['company', id],
    { enabled: !!id },
  );

  if (isLoading) return <PageShell title="Company" icon={Building2} description="Loading..."><div className="p-6 text-sm text-muted-foreground">Loading company...</div></PageShell>;
  if (!company) return <PageShell title="Company" icon={Building2} description="Not found"><div className="p-6 text-sm text-muted-foreground">Company not found.</div></PageShell>;

  return (
    <PageShell
      title={company.name}
      icon={Building2}
      description={company.industry ? `${company.industry} · ${company.lifecycle_stage}` : company.lifecycle_stage}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/crm/companies"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <CompanyHeader company={company} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Total Revenue</p><p className="text-xl font-bold">{formatCurrency(Number(company.total_revenue ?? 0))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Projects</p><p className="text-xl font-bold">{company.total_projects ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Tasks</p><p className="text-xl font-bold">{company.total_tasks ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Deals</p><p className="text-xl font-bold">{company.total_deals ?? 0}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="value">Value Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4"><CompanyOverview company={company} /></TabsContent>
        <TabsContent value="contacts"><CompanyContacts companyId={id} /></TabsContent>
        <TabsContent value="users"><CompanyUsers companyId={id} /></TabsContent>
        <TabsContent value="invoices"><CompanyInvoices companyId={id} /></TabsContent>
        <TabsContent value="payments"><CompanyPayments companyId={id} /></TabsContent>
        <TabsContent value="deals"><CompanyDeals companyId={id} /></TabsContent>
        <TabsContent value="documents"><CompanyDocuments companyId={id} /></TabsContent>
        <TabsContent value="value"><CompanyValue companyId={id} /></TabsContent>
      </Tabs>
    </PageShell>
  );
}

function CompanyHeader({ company }: { company: Company }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">
          {company.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            {company.name}
            <StatusBadge status={company.lifecycle_stage} />
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {company.industry && <Badge variant="outline">{company.industry}</Badge>}
            {company.effective_email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {company.effective_email}</span>}
            {company.effective_phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {company.effective_phone}</span>}
            {company.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {company.city}{company.country ? `, ${company.country}` : ''}</span>}
            {company.domain && <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {company.domain}</span>}
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm text-muted-foreground">Total Revenue</p>
        <p className="text-2xl font-semibold">{formatCurrency(Number(company.total_revenue ?? 0))}</p>
      </div>
    </div>
  );
}

function CompanyOverview({ company }: { company: Company }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Industry</span> <span>{company.industry || '-'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Size</span> <span>{company.company_size || '-'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Stage</span> <span>{company.lifecycle_stage || '-'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Owner</span> <span>{company.owner ? `${company.owner.first_name} ${company.owner.last_name}` : '-'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Address</span> <span>{[company.address_line1, company.city, company.state, company.postal_code].filter(Boolean).join(', ') || '-'}</span></div>
          {company.description && <p className="pt-2 text-muted-foreground">{company.description}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Primary Contact</CardTitle></CardHeader>
        <CardContent>
          {company.primary_contact ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium flex items-center gap-2"><User className="h-3.5 w-3.5" /> {company.primary_contact.name}</p>
              <p className="text-muted-foreground">{company.primary_contact.email}</p>
              {company.primary_contact.phone && <p className="text-muted-foreground">{company.primary_contact.phone}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No primary contact.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyContacts({ companyId }: { companyId: string }) {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['company-contacts', companyId],
    queryFn: () => fetchCompanyContacts(token!, companyId),
    enabled: !!token,
  });

  const contacts = data?.contacts ?? [];
  return (
    <DataTable
      headers={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'stage', label: 'Stage' }, { key: 'primary', label: 'Primary' }]}
      data={contacts}
      loading={isLoading}
      keyExtractor={(c) => c.id}
      onRowClick={(c) => {}}
      emptyText="No contacts."
      renderRow={(c) => [
        <Link key="name" href={`/admin/crm/contacts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>,
        <span key="email" className="text-muted-foreground">{c.email}</span>,
        <span key="phone" className="text-muted-foreground">{c.phone || '-'}</span>,
        <Badge key="stage" variant="outline">{c.lifecycle_stage || '-'}</Badge>,
        <span key="primary">{c.is_primary ? 'Yes' : 'No'}</span>,
      ]}
    />
  );
}

function CompanyDeals({ companyId }: { companyId: string }) {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['company-deals', companyId],
    queryFn: () => fetchCompanyDeals(token!, companyId),
    enabled: !!token,
  });

  const deals = data?.deals ?? [];
  return (
    <DataTable
      headers={[{ key: 'ref', label: 'Ref' }, { key: 'title', label: 'Title' }, { key: 'stage', label: 'Stage' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' }, { key: 'close', label: 'Close Date' }]}
      data={deals}
      loading={isLoading}
      keyExtractor={(d) => d.id}
      emptyText="No deals."
      renderRow={(d) => [
        <span key="ref">{d.deal_number || `#${d.id}`}</span>,
        <Link key="title" href={`/admin/crm/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>,
        <span key="stage" className="text-muted-foreground">{d.stage || '-'}</span>,
        <span key="amount">{formatCurrency(Number(d.value ?? 0))}</span>,
        <StatusBadge key="status" status={d.status} />,
        <span key="close" className="text-muted-foreground">{formatDate(d.actual_close_date || d.expected_close_date)}</span>,
      ]}
    />
  );
}

function CompanyUsers({ companyId }: { companyId: string }) {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: () => fetchCompanyUsers(token!, companyId),
    enabled: !!token,
  });

  return (
    <DataTable
      headers={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' }, { key: 'status', label: 'Status' }]}
      data={data ?? []}
      loading={isLoading}
      keyExtractor={(u) => u.id}
      renderRow={(u) => [
        <span key="name">{u.first_name} {u.last_name}</span>,
        <span key="email" className="text-muted-foreground">{u.email}</span>,
        <Badge key="role" variant="outline">{u.role}</Badge>,
        <StatusBadge key="status" status={u.status} />,
      ]}
    />
  );
}

function CompanyInvoices({ companyId }: { companyId: string }) {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['company-invoices', companyId],
    queryFn: () => fetchCompanyInvoices(token!, companyId),
    enabled: !!token,
  });

  const invoices = data?.invoices ?? [];
  return (
    <DataTable
      headers={[{ key: 'ref', label: 'Reference' }, { key: 'title', label: 'Title' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Issue Date' }]}
      data={invoices}
      loading={isLoading}
      keyExtractor={(i) => i.id}
      renderRow={(i) => [
        <span key="ref">{i.package_code || i.invoice_number || `#${i.id}`}</span>,
        <span key="title">{i.title || '-'}</span>,
        <span key="amount">{formatCurrency(Number(i.total_amount ?? 0))}</span>,
        <StatusBadge key="status" status={i.status} />,
        <span key="date">{formatDate(i.issue_date)}</span>,
      ]}
    />
  );
}

function CompanyPayments({ companyId }: { companyId: string }) {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['company-payments', companyId],
    queryFn: () => fetchCompanyPayments(token!, companyId),
    enabled: !!token,
  });

  const payments = data?.payments ?? [];
  return (
    <DataTable
      headers={[{ key: 'id', label: 'ID' }, { key: 'amount', label: 'Amount' }, { key: 'method', label: 'Method' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Date' }]}
      data={payments}
      loading={isLoading}
      keyExtractor={(p) => p.id}
      renderRow={(p) => [
        <span key="id">{p.transaction_id || `#${p.id}`}</span>,
        <span key="amount">{formatCurrency(Number(p.amount ?? 0))}</span>,
        <span key="method">{p.payment_method || '-'}</span>,
        <StatusBadge key="status" status={p.status} />,
        <span key="date">{formatDate(p.payment_date)}</span>,
      ]}
    />
  );
}

function CompanyDocuments({ companyId }: { companyId: string }) {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['company-documents', companyId],
    queryFn: () => fetchCompanyDocuments(token!, companyId),
    enabled: !!token,
  });

  const docs = [...(data?.documents ?? []), ...(data?.subprojectDocuments ?? [])];
  return (
    <DataTable
      headers={[{ key: 'name', label: 'Name' }, { key: 'source', label: 'Source' }, { key: 'size', label: 'Size' }, { key: 'date', label: 'Created' }]}
      data={docs}
      loading={isLoading}
      keyExtractor={(d) => d.id}
      renderRow={(d) => [
        <span key="name">{d.file_name}</span>,
        <Badge key="source" variant="outline">{d.source || d.category || 'document'}</Badge>,
        <span key="size">{d.file_size}</span>,
        <span key="date">{formatDate(d.created_at)}</span>,
      ]}
    />
  );
}

function CompanyValue({ companyId }: { companyId: string }) {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['company-value', companyId],
    queryFn: () => fetchCompanyValueBreakdown(token!, companyId),
    enabled: !!token,
  });

  const rows = data?.breakdown ?? [];
  return (
    <DataTable
      headers={[{ key: 'type', label: 'Type' }, { key: 'reference', label: 'Reference' }, { key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' }]}
      data={rows}
      loading={isLoading}
      keyExtractor={(r, i) => `${r.type}-${r.id}-${i}`}
      renderRow={(r) => [
        <Badge key="type" variant="outline" className="capitalize">{r.type}</Badge>,
        <span key="ref">{r.reference}</span>,
        <span key="desc">{r.description}</span>,
        <span key="amount">{formatCurrency(Number(r.amount ?? 0))}</span>,
        <StatusBadge key="status" status={r.status} />,
      ]}
    />
  );
}
