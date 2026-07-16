'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PublicHoliday } from '@/types/hr';

interface PublicHolidayTableProps {
  holidays: PublicHoliday[];
  loading: boolean;
}

export function PublicHolidayTable({ holidays, loading }: PublicHolidayTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (holidays.length === 0) {
    return <div className="rounded-lg border p-8 text-center text-muted-foreground">No public holidays found.</div>;
  }

  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '-');

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Recurring</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holidays.map((holiday) => (
            <TableRow key={holiday.id}>
              <TableCell className="font-medium">{holiday.name}</TableCell>
              <TableCell>{formatDate(holiday.holiday_date)}</TableCell>
              <TableCell>{holiday.location || '-'}</TableCell>
              <TableCell>
                <Badge variant={holiday.is_recurring ? 'default' : 'outline'}>{holiday.is_recurring ? 'Yes' : 'No'}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
