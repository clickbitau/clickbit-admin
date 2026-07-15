'use client';

import { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';

interface DataTableProps<T> {
  headers: { key: string; label: ReactNode; className?: string }[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  renderRow: (row: T, index: number) => ReactNode[];
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (row: T, index: number) => void;
}

export function DataTable<T>({
  headers,
  data,
  keyExtractor,
  renderRow,
  loading,
  emptyText = 'No records found.',
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h.key} className={h.className}>
                {h.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            const cells = renderRow(row, index);
            return (
              <TableRow
                key={keyExtractor(row, index)}
                className={onRowClick ? 'cursor-pointer' : undefined}
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              >
                {cells.map((cell, i) => (
                  <TableCell key={i}>{cell}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
