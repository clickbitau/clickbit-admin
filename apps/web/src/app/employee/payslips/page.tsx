'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchEmployeePayslips, fetchPayslipPdf } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Receipt, Download, Wallet, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Payslip } from '@/types/hr';

function getYears() {
  const current = new Date().getFullYear();
  const years = [];
  for (let i = current; i >= current - 5; i--) years.push(i);
  return years;
}

export default function EmployeePayslipsPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [year, setYear] = useState<string>('all');
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['employee-payslips', token, page, year],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: { page: number; limit: number; year?: number } = { page, limit };
      if (year !== 'all') params.year = Number(year);
      return fetchEmployeePayslips(token, params);
    },
    enabled: !!token,
  });

  const downloadMutation = useMutation({
    mutationFn: async (payslip: Payslip) => {
      if (!token) throw new Error('No token');
      const blob = await fetchPayslipPdf(token, payslip.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip-${payslip.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: () => toast.error('Failed to download PDF'),
  });

  const payslips = useMemo(() => data?.data ?? [], [data]);
  const pagination = data?.pagination;

  const latest = payslips[0];
  const ytd = useMemo(() => {
    if (!latest) return { gross: 0, tax: 0, super: 0 };
    return {
      gross: latest.ytd_gross ?? 0,
      tax: latest.ytd_tax ?? 0,
      super: latest.ytd_super ?? 0,
    };
  }, [latest]);

  const summary = useMemo(() => {
    return {
      total: payslips.reduce((sum, p) => sum + Number(p.gross_pay ?? 0), 0),
      net: payslips.reduce((sum, p) => sum + Number(p.net_pay ?? 0), 0),
      tax: payslips.reduce((sum, p) => sum + Number(p.tax_withheld ?? 0), 0),
      count: payslips.length,
    };
  }, [payslips]);

  return (
    <PageShell title="My Payslips" icon={Receipt} description="Your payment history and year-to-date summary.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="nm-raised">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">YTD Gross</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(ytd.gross)}</p>
          </CardContent>
        </Card>
        <Card className="nm-raised">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">YTD Tax</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(ytd.tax)}</p>
          </CardContent>
        </Card>
        <Card className="nm-raised">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">YTD Super</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(ytd.super)}</p>
          </CardContent>
        </Card>
        <Card className="nm-raised">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payslips</p>
            <p className="text-2xl font-bold mt-1">{summary.count}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="nm-raised">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Payslips
            </CardTitle>
            <Select value={year} onValueChange={(v) => { setYear(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {getYears().map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : (
            <DataTable
              headers={[
                { key: 'period', label: 'Period' },
                { key: 'payment', label: 'Payment Date' },
                { key: 'gross', label: 'Gross' },
                { key: 'tax', label: 'Tax' },
                { key: 'super', label: 'Super' },
                { key: 'net', label: 'Net' },
                { key: 'status', label: 'Status' },
                { key: 'actions', label: '', className: 'w-24' },
              ]}
              data={payslips}
              keyExtractor={(p) => p.id}
              loading={isLoading}
              emptyText="No payslips found."
              renderRow={(p: Payslip) => [
                <Link key="period" href={`/employee/payslips/${p.id}`} className="hover:underline font-medium">
                  {formatDate(p.pay_period_start)} - {formatDate(p.pay_period_end)}
                </Link>,
                <span key="payment">{formatDate(p.payment_date)}</span>,
                <span key="gross">{formatCurrency(Number(p.gross_pay), p.currency)}</span>,
                <span key="tax">{formatCurrency(Number(p.tax_withheld), p.currency)}</span>,
                <span key="super">{formatCurrency(Number(p.superannuation), p.currency)}</span>,
                <span key="net" className="font-medium">{formatCurrency(Number(p.net_pay), p.currency)}</span>,
                <StatusBadge key="status" status={p.status} />,
                <div key="actions" className="flex items-center justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => downloadMutation.mutate(p)}
                    disabled={downloadMutation.isPending}
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                    <Link href={`/employee/payslips/${p.id}`}>
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>,
              ]}
            />
          )}
          {pagination && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>

      {payslips.length > 0 && (
        <div className="nm-raised p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3">Period Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Gross</p>
              <p className="font-semibold">{formatCurrency(summary.total)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Tax</p>
              <p className="font-semibold">{formatCurrency(summary.tax)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Net</p>
              <p className="font-semibold">{formatCurrency(summary.net)}</p>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
