'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { useRealtimeRefresh } from '@/lib/realtime';
import {
  fetchCompany,
  fetchCompanyUsers,
  fetchCompanyInvoices,
  fetchCompanyPayments,
  fetchCompanyDocuments,
  fetchCompanyValueBreakdown,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Company } from '@/types/crm';
import { ArrowLeft, Building2, Mail, Phone, MapPin, Globe } from 'lucide-react';

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

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading company...</div>;
  if (!company) return <div className="p-6 text-sm text-muted-foreground">Company not found.</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/crm/companies"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
        </div>

        <CompanyHeader company={company} />

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="value">Value Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <CompanyOverview company={company} />
          </TabsContent>
          <TabsContent value="users"><CompanyUsers companyId={id} /></TabsContent>
          <TabsContent value="invoices"><CompanyInvoices companyId={id} /></TabsContent>
          <TabsContent value="payments"><CompanyPayments companyId={id} /></TabsContent>
          <TabsContent value="documents"><CompanyDocuments companyId={id} /></TabsContent>
          <TabsContent value="value"><CompanyValue companyId={id} /></TabsContent>
        </Tabs>
      </div>
    </div>
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
        <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
        <CardContent>
          {company.activities && company.activities.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {(company.activities as { id: number; activity_type: string; subject: string; due_date?: string }[]).slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <span>{a.subject} <Badge variant="secondary">{a.activity_type}</Badge></span>
                  <span className="text-muted-foreground">{formatDate(a.due_date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activities.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Deals</CardTitle></CardHeader>
        <CardContent>
          {company.deals && (company.deals as { id: number; title: string; value?: number; status: string }[]).length > 0 ? (
            <ul className="space-y-2 text-sm">
              {(company.deals as { id: number; title: string; value?: number; status: string }[]).slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <span>{d.title}</span>
                  <span className="font-medium">{formatCurrency(d.value ?? 0)} <StatusBadge status={d.status} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No deals.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Contacts</CardTitle></CardHeader>
        <CardContent>
          {company.primary_contact ? (
            <div className="text-sm">
              <p className="font-medium">{company.primary_contact.name}</p>
              <p className="text-muted-foreground">{company.primary_contact.email}</p>
            </div>
          ) : company.contactAssociations && (company.contactAssociations as { contact: { id: number; name: string; email?: string; phone?: string } }[]).length > 0 ? (
            <ul className="space-y-2 text-sm">
              {(company.contactAssociations as { contact: { id: number; name: string; email?: string; phone?: string } }[]).slice(0, 5).map(({ contact }) => (
                <li key={contact.id} className="border-b py-2 last:border-0">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-muted-foreground">{contact.email || contact.phone || '-'}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No contacts.</p>
          )}
        </CardContent>
      </Card>
    </div>
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
        <a key="name" href={d.file_url} target="_blank" rel="noreferrer" className="hover:underline">{d.title || d.original_filename || d.file_name}</a>,
        <Badge key="source" variant="outline">{d.source || 'company'}</Badge>,
        <span key="size">{d.file_size ? `${Math.round(d.file_size / 1024)} KB` : '-'}</span>,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Value Breakdown</CardTitle>
        <p className="text-2xl font-semibold">{formatCurrency(data?.total ?? 0)}</p>
      </CardHeader>
      <CardContent>
        <DataTable
          headers={[{ key: 'type', label: 'Type' }, { key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' }]}
          data={data?.breakdown ?? []}
          loading={isLoading}
          keyExtractor={(v, i) => `${v.type}-${v.id}-${i}`}
          renderRow={(v) => [
            <Badge key="type" variant="outline">{v.type}</Badge>,
            <span key="desc">{v.description}</span>,
            <span key="amount">{formatCurrency(v.amount, v.currency)}</span>,
            <StatusBadge key="status" status={v.status} />,
          ]}
        />
      </CardContent>
    </Card>
  );
}
