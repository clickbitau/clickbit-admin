'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchEmployeePayslips, fetchPayslipPdf } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Receipt, Download, ArrowUpRight, Search, Wallet, Calendar, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import type { Payslip } from '@/types/hr';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
];

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
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = payslips;
    if (status !== 'all') rows = rows.filter((p) => p.status?.toLowerCase() === status);
    if (q) {
      rows = rows.filter((p) =>
        formatDate(p.pay_period_start).toLowerCase().includes(q) ||
        formatDate(p.pay_period_end).toLowerCase().includes(q) ||
        formatDate(p.payment_date).toLowerCase().includes(q)
      );
    }
    return rows;
  }, [payslips, status, search]);

  const stats = useMemo(() => {
    const paid = payslips.filter((p) => p.status?.toLowerCase() === 'paid');
    return {
      ytdGross: ytd.gross,
      ytdTax: ytd.tax,
      ytdSuper: ytd.super,
      paidCount: paid.length,
    };
  }, [payslips, ytd]);

  return (
    <PageShell
      title="My Payslips"
      icon={Receipt}
      description="Your payment history and year-to-date summary."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={status === s.key ? 'default' : 'outline'}
                onClick={() => { setStatus(s.key); setPage(1); }}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      }
    >
      <StatCards
        cards={[
          { label: 'YTD Gross', value: formatCurrency(stats.ytdGross), icon: Wallet, accent: 'primary' },
          { label: 'YTD Tax', value: formatCurrency(stats.ytdTax), icon: Receipt, accent: 'warning' },
          { label: 'YTD Super', value: formatCurrency(stats.ytdSuper), icon: Wallet, accent: 'secondary' },
          { label: 'Paid', value: stats.paidCount, icon: Calendar, accent: 'success' },
        ]}
      />

      <Card className="nm-raised p-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search payslips..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">
          {search || status !== 'all' ? 'No payslips match your filters.' : 'No payslips found.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p: Payslip) => (
            <Card key={p.id} className="nm-raised hover:shadow-md transition-all">
              <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 p-4">
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-primary" />
                    {formatDate(p.pay_period_start)} – {formatDate(p.pay_period_end)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Paid {formatDate(p.payment_date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
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
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="font-medium">{formatCurrency(Number(p.gross_pay), p.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tax</p>
                  <p className="font-medium">{formatCurrency(Number(p.tax_withheld), p.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Super</p>
                  <p className="font-medium">{formatCurrency(Number(p.superannuation), p.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="font-semibold">{formatCurrency(Number(p.net_pay), p.currency)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={setPage}
        />
      )}
    </PageShell>
  );
}
