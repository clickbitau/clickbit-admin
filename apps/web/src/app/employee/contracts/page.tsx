'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { fetchEmployeeContracts } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { FileText } from 'lucide-react';

export default function EmployeeContractsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['employee-contracts', token, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeeContracts(token, { page, limit });
    },
    enabled: !!token,
  });

  return (
    <PageShell title="My Contracts" icon={FileText} description="Your employment contracts.">
      <DataTable
        headers={[
          { key: 'number', label: 'Contract #' },
          { key: 'type', label: 'Type' },
          { key: 'position', label: 'Position' },
          { key: 'start', label: 'Start' },
          { key: 'end', label: 'End' },
          { key: 'salary', label: 'Salary / Rate' },
          { key: 'status', label: 'Status' },
        ]}
        data={data?.data ?? []}
        keyExtractor={(c) => c.id}
        loading={isLoading}
        emptyText="No contracts found."
        onRowClick={(c) => router.push(`/employee/contracts/${c.id}`)}
        renderRow={(c: any) => [
          <span key="number">{c.contract_number || `#${c.id}`}</span>,
          <span key="type" className="capitalize">{c.employment_type?.replace(/_/g, ' ') || '-'}</span>,
          <span key="position">{c.position || '-'}</span>,
          <span key="start">{formatDate(c.start_date)}</span>,
          <span key="end">{formatDate(c.end_date)}</span>,
          <span key="salary">{c.salary ? formatCurrency(Number(c.salary), c.currency) : c.hourly_rate ? `${formatCurrency(Number(c.hourly_rate), c.currency)}/hr` : '-'}</span>,
          <span key="status" className="text-xs capitalize">{c.status || '-'}</span>,
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
