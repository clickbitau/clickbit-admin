'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchEmployeePayslip } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Receipt, ArrowLeft, Download } from 'lucide-react';

export default function EmployeePayslipDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = String(params.id);

  const { data, isLoading } = useQuery({
    queryKey: ['employee-payslip', id, token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeePayslip(token, id);
    },
    enabled: !!token && !!id,
  });

  const payslip = data?.data;

  if (isLoading) {
    return (
      <PageShell title="Payslip" icon={Receipt}>
        <Skeleton className="h-40 rounded-2xl" />
      </PageShell>
    );
  }

  if (!payslip) {
    return (
      <PageShell title="Payslip" icon={Receipt}>
        <p className="text-sm text-muted-foreground">Payslip not found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`Payslip — ${formatDate(payslip.pay_period_start)} to ${formatDate(payslip.pay_period_end)}`}
      icon={Receipt}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/employee/payslips"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          {payslip.pdf_url && (
            <Button size="sm" asChild>
              <a href={payslip.pdf_url} target="_blank" rel="noreferrer"><Download className="mr-1 h-4 w-4" /> PDF</a>
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Pay Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Gross Pay</span> <span>{formatCurrency(Number(payslip.gross_pay), payslip.currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax Withheld</span> <span>{formatCurrency(Number(payslip.tax_withheld), payslip.currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Superannuation</span> <span>{formatCurrency(Number(payslip.superannuation), payslip.currency)}</span></div>
            <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700"><span className="font-medium">Net Pay</span> <span className="font-bold">{formatCurrency(Number(payslip.net_pay), payslip.currency)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>YTD</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Gross YTD</span> <span>{formatCurrency(Number(payslip.ytd_gross), payslip.currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax YTD</span> <span>{formatCurrency(Number(payslip.ytd_tax), payslip.currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Super YTD</span> <span>{formatCurrency(Number(payslip.ytd_super), payslip.currency)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Payment Date</span> <span>{formatDate(payslip.payment_date)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pay Frequency</span> <span className="capitalize">{payslip.pay_frequency?.replace(/_/g, ' ') || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span> <span className="capitalize">{payslip.status || '-'}</span></div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
