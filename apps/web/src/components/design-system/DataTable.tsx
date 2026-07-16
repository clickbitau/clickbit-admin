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
      <div className="nm-raised p-4 space-y-3">
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
    <div className="nm-raised overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/50 hover:bg-transparent">
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
                className={`border-b border-border/30 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-primary/5' : 'hover:bg-primary/5'}`}
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
