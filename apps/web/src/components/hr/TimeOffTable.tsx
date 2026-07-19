'use client';

import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import type { TimeOffRequest } from '@/types/hr';

interface TimeOffTableProps {
  requests: TimeOffRequest[];
  loading: boolean;
}

export function TimeOffTable({ requests, loading }: TimeOffTableProps) {
  const router = useRouter();
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (requests.length === 0) {
    return <div className="rounded-lg border p-8 text-center text-muted-foreground">No time-off requests found.</div>;
  }

  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '-');

  return (
    <div className="nm-raised overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Days</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => {
            const user = request.employee?.user;
            const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : `Employee #${request.employee_id}`;
            return (
              <TableRow key={request.id} className="cursor-pointer" onClick={() => router.push(`/admin/hr/time-off/${request.id}`)}>
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell className="capitalize">{request.leave_type}</TableCell>
                <TableCell>{formatDate(request.start_date)}</TableCell>
                <TableCell>{formatDate(request.end_date)}</TableCell>
                <TableCell>{request.total_days ?? '-'}</TableCell>
                <TableCell>
                  <StatusBadge status={request.status || 'pending'} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
