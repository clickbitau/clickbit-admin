'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Calendar, Calculator, Download, FileText, Mail, Trash2 } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/auth/AuthProvider';
import { calculatePayslip, deletePayslip, fetchPayslips, nextPayRun, resendPayslipEmail } from '@/lib/api';

function formatCurrency(value: number | string | undefined, currency?: string) {
  const n = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : 0;
  return `${currency || 'AUD'} ${isNaN(n) ? '0.00' : n.toFixed(2)}`;
}

export default function AdminHrPayslipsPage() {
  const { token } = useAuth();
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

  const payslips = useMemo(() => data?.data ?? [], [data?.data]);
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 20 };

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

  const statCards = [
    { label: 'Total Payslips', value: pagination.total, icon: FileText },
    { label: 'Total Gross', value: formatCurrency(totalGross), icon: Banknote },
    { label: 'Total Net', value: formatCurrency(totalNet), icon: Banknote, accent: 'success' as const },
    { label: 'Overdue', value: 0, icon: Calendar },
  ];

  const statusColor: Record<string, string> = {
    draft: 'secondary',
    generated: 'secondary',
    pending: 'warning',
    paid: 'default',
    sent: 'outline',
  };

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
        <Card>
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

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive">Failed to load payslips.</div>}
          {isLoading && <div className="text-muted-foreground">Loading...</div>}

          {!isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">No payslips found.</TableCell>
                  </TableRow>
                )}
                {payslips.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.employee?.name || `Employee ${p.employee_id}`}</TableCell>
                    <TableCell>{new Date(p.pay_period_start).toLocaleDateString()} — {new Date(p.pay_period_end).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{formatCurrency(p.gross_pay, p.currency)}</TableCell>
                    <TableCell>{formatCurrency(p.tax_withheld, p.currency)}</TableCell>
                    <TableCell>{formatCurrency(p.net_pay, p.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={(statusColor[p.status || ''] as any) || 'secondary'}>{p.status || 'generated'}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {p.pdf_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={p.pdf_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => resendMutation.mutate(p.id)} disabled={resendMutation.isPending}>
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(p.id)} disabled={removeMutation.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</p>
            <div className="space-x-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
