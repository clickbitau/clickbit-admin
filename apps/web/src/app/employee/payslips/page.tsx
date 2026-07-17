'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { fetchEmployeePayslips } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Receipt } from 'lucide-react';

export default function EmployeePayslipsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['employee-payslips', token, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeePayslips(token, { page, limit });
    },
    enabled: !!token,
  });

  return (
    <PageShell title="My Payslips" icon={Receipt} description="Your payment history.">
      <DataTable
        headers={[
          { key: 'period', label: 'Period' },
          { key: 'payment', label: 'Payment Date' },
          { key: 'gross', label: 'Gross' },
          { key: 'tax', label: 'Tax' },
          { key: 'super', label: 'Super' },
          { key: 'net', label: 'Net' },
          { key: 'status', label: 'Status' },
        ]}
        data={data?.data ?? []}
        keyExtractor={(p) => p.id}
        loading={isLoading}
        emptyText="No payslips found."
        onRowClick={(p) => router.push(`/employee/payslips/${p.id}`)}
        renderRow={(p: any) => [
          <span key="period">{formatDate(p.pay_period_start)} - {formatDate(p.pay_period_end)}</span>,
          <span key="payment">{formatDate(p.payment_date)}</span>,
          <span key="gross">{formatCurrency(Number(p.gross_pay), p.currency)}</span>,
          <span key="tax">{formatCurrency(Number(p.tax_withheld), p.currency)}</span>,
          <span key="super">{formatCurrency(Number(p.superannuation), p.currency)}</span>,
          <span key="net" className="font-medium">{formatCurrency(Number(p.net_pay), p.currency)}</span>,
          <span key="status" className="text-xs capitalize">{p.status || '-'}</span>,
        ]}
      />
      {data?.pagination && (
        <Pagination
          currentPage={data.pagination.currentPage}
          totalPages={data.pagination.totalPages}
          totalItems={data.pagination.totalItems}
          onPageChange={setPage}
        />
      )}
    </PageShell>
  );
}
