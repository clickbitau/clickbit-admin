'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { fetchEmployeeTimeOff } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Calendar } from 'lucide-react';

export default function EmployeeTimeOffPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['employee-time-off', token, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeeTimeOff(token, { page, limit });
    },
    enabled: !!token,
  });

  return (
    <PageShell title="My Time Off" icon={Calendar} description="Your leave requests and balances.">
      <DataTable
        headers={[
          { key: 'type', label: 'Type' },
          { key: 'dates', label: 'Dates' },
          { key: 'days', label: 'Days' },
          { key: 'status', label: 'Status' },
          { key: 'reviewer', label: 'Reviewed By' },
        ]}
        data={data?.data ?? []}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyText="No time-off requests found."
        renderRow={(r: any) => [
          <span key="type" className="capitalize">{r.leave_type?.replace(/_/g, ' ')}</span>,
          <span key="dates">{formatDate(r.start_date)} - {formatDate(r.end_date)}</span>,
          <span key="days">{r.total_days ?? '-'}</span>,
          <StatusBadge key="status" status={r.status} />,
          <span key="reviewer">{r.reviewer?.name || '-'}</span>,
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
