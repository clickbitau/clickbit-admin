'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, Calendar, Calculator, Download, FileText, Mail, Trash2 } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  calculatePayslip,
  deletePayslip,
  fetchHrStats,
  fetchPayslips,
  fetchPayslipPdf,
  nextPayRun,
  resendPayslipEmail,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';

export default function AdminHrPayslipsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: 20 };
    if (status) p.status = status;
    if (search) p.search = search;
    if (year) p.year = year;
    return p;
  }, [status, search, year, page]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payslips', token, params],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchPayslips(token, params);
    },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
    enabled: !!token,
  });

  const payslips = useMemo(() => data?.data ?? [], [data?.data]);
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 20 };
  const stats = statsData?.data;

  const totalGross = useMemo(() => payslips.reduce((sum, p) => sum + (parseFloat(String(p.gross_pay)) || 0), 0), [payslips]);
  const totalNet = useMemo(() => payslips.reduce((sum, p) => sum + (parseFloat(String(p.net_pay)) || 0), 0), [payslips]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['payslips', token] });

  const payRunMutation = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('No token');
      return nextPayRun(token);
    },
    onSuccess: refresh,
  });

  const calculateMutation = useMutation({
    mutationFn: ({ employeeId, start, end, paymentDate, manualHours }: any) => {
      if (!token) throw new Error('No token');
      return calculatePayslip(token, { employeeId, periodStart: start, periodEnd: end, paymentDate, manualHours });
    },
  });

  const resendMutation = useMutation({
    mutationFn: (id: number) => {
      if (!token) throw new Error('No token');
      return resendPayslipEmail(token, id);
    },
    onSuccess: refresh,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => {
      if (!token) throw new Error('No token');
      return deletePayslip(token, id);
    },
    onSuccess: refresh,
  });

  const downloadPdf = async (id: number) => {
    if (!token) return;
    try {
      const blob = await fetchPayslipPdf(token, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast?.error?.(err?.response?.data?.message || 'Failed to download PDF');
    }
  };

  const statCards = stats ? [
    { label: 'Total', value: stats.payslips.total, icon: FileText, onClick: () => { setStatus(''); setPage(1); } },
    { label: 'Generated', value: stats.payslips.generated, icon: FileText, accent: 'warning' as const, onClick: () => { setStatus('generated'); setPage(1); } },
    { label: 'Paid', value: stats.payslips.paid, icon: Banknote, accent: 'success' as const, onClick: () => { setStatus('paid'); setPage(1); } },
    { label: 'Sent', value: stats.payslips.sent, icon: Banknote, onClick: () => { setStatus('sent'); setPage(1); } },
  ] : [
    { label: 'Total Payslips', value: pagination.total, icon: FileText },
    { label: 'Total Gross', value: formatCurrency(totalGross), icon: Banknote },
    { label: 'Total Net', value: formatCurrency(totalNet), icon: Banknote, accent: 'success' as const },
    { label: 'Overdue', value: 0, icon: Calendar },
  ];

  return (
    <PageShell title="Payslips" icon={Banknote} description="Calculate, review, and manage employee payslips.">
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="generated">Generated</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="sent">Sent</option>
        </select>
        <Input placeholder="Search employee..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        <Input placeholder="FY Year" value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} className="max-w-[100px]" />
        <Button onClick={() => payRunMutation.mutate()} disabled={payRunMutation.isPending}>
          <Calculator className="mr-2 h-4 w-4" /> Next Pay Run
        </Button>
      </div>

      {calculateMutation.data && (
        <Card className="nm-raised">
          <CardHeader>
            <CardTitle>Calculated Payslip Preview</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Employee: {calculateMutation.data.data.employee_name}</p>
            <p>Gross: {formatCurrency(calculateMutation.data.data.gross_pay, calculateMutation.data.data.currency)}</p>
            <p>Tax: {formatCurrency(calculateMutation.data.data.tax_withheld, calculateMutation.data.data.currency)}</p>
            <p>Super: {formatCurrency(calculateMutation.data.data.superannuation, calculateMutation.data.data.currency)}</p>
            <p>Net: {formatCurrency(calculateMutation.data.data.net_pay, calculateMutation.data.data.currency)}</p>
          </CardContent>
        </Card>
      )}

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="text-destructive">Failed to load payslips.</div>}

          <DataTable
            headers={[
              { key: 'employee', label: 'Employee' },
              { key: 'period', label: 'Period' },
              { key: 'payment_date', label: 'Payment Date' },
              { key: 'gross', label: 'Gross' },
              { key: 'tax', label: 'Tax' },
              { key: 'net', label: 'Net' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '', className: 'w-40 text-right' },
            ]}
            data={payslips}
            keyExtractor={(p: any) => p.id}
            loading={isLoading}
            emptyText="No payslips found."
            onRowClick={(p: any) => router.push(`/admin/hr/payslips/${p.id}`)}
            renderRow={(p: any) => [
              <span key="employee">{p.employee?.name || `Employee ${p.employee_id}`}</span>,
              <span key="period">{formatDate(p.pay_period_start)} — {formatDate(p.pay_period_end)}</span>,
              <span key="payment_date">{formatDate(p.payment_date)}</span>,
              <span key="gross">{formatCurrency(Number(p.gross_pay), p.currency)}</span>,
              <span key="tax">{formatCurrency(Number(p.tax_withheld), p.currency)}</span>,
              <span key="net">{formatCurrency(Number(p.net_pay), p.currency)}</span>,
              <StatusBadge key="status" status={p.status || 'generated'} />,
              <div key="actions" className="flex items-center justify-end gap-1">
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); p.pdf_url ? window.open(p.pdf_url, '_blank') : downloadPdf(p.id); }}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); resendMutation.mutate(p.id); }} disabled={resendMutation.isPending}>
                  <Mail className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); removeMutation.mutate(p.id); }} disabled={removeMutation.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>,
            ]}
          />

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
