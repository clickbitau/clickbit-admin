'use client';

import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Reminder } from '@/types/hr';

interface ReminderTableProps {
  reminders: Reminder[];
  loading: boolean;
}

export function ReminderTable({ reminders, loading }: ReminderTableProps) {
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

  if (reminders.length === 0) {
    return <div className="rounded-lg border p-8 text-center text-muted-foreground">No reminders found.</div>;
  }

  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '-');

  return (
    <div className="nm-raised overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Reminder Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reminders.map((reminder) => (
            <TableRow key={reminder.id} className="cursor-pointer" onClick={() => router.push(`/admin/hr/reminders/${reminder.id}`)}>
              <TableCell className="font-medium">{reminder.title}</TableCell>
              <TableCell className="capitalize">{reminder.trigger_type || 'regular'}</TableCell>
              <TableCell>{formatDate(reminder.reminder_date)}</TableCell>
              <TableCell>
                <StatusBadge status={reminder.status || 'pending'} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
