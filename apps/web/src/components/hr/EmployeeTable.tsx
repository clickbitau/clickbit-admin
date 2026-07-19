'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Employee } from '@/types/hr';

interface EmployeeTableProps {
  employees: Employee[];
  loading: boolean;
  onRowClick?: (employee: Employee) => void;
}

export function EmployeeTable({ employees, loading, onRowClick }: EmployeeTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (employees.length === 0) {
    return <div className="rounded-lg border p-8 text-center text-muted-foreground">No employees found.</div>;
  }

  return (
    <div className="nm-raised overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Number</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => {
            const user = employee.user;
            const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : `Employee #${employee.id}`;
            return (
              <TableRow key={employee.id} className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''} onClick={() => onRowClick?.(employee)}>
                <TableCell className="font-medium">
                  {onRowClick ? (
                    <span className="hover:underline">{name}</span>
                  ) : (
                    <Link href={`/admin/hr/employees/${employee.id}`} className="hover:underline">{name}</Link>
                  )}
                </TableCell>
                <TableCell>{employee.employee_number || `#${employee.id}`}</TableCell>
                <TableCell>{employee.department || '-'}</TableCell>
                <TableCell>{employee.position || '-'}</TableCell>
                <TableCell className="capitalize">{(employee.employment_type || '').replace(/_/g, ' ')}</TableCell>
                <TableCell>
                  <StatusBadge status={employee.employment_status || 'active'} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
