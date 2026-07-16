'use client';

import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Announcement } from '@/types/hr';

interface AnnouncementTableProps {
  announcements: Announcement[];
  loading: boolean;
}

export function AnnouncementTable({ announcements, loading }: AnnouncementTableProps) {
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

  if (announcements.length === 0) {
    return <div className="rounded-lg border p-8 text-center text-muted-foreground">No announcements found.</div>;
  }

  const statusVariant = (status?: string | null) => {
    switch (status) {
      case 'published':
        return 'default';
      case 'scheduled':
        return 'secondary';
      case 'archived':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '-');

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Published</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {announcements.map((announcement) => (
            <TableRow key={announcement.id} className="cursor-pointer" onClick={() => router.push(`/admin/hr/announcements/${announcement.id}`)}>
              <TableCell className="font-medium">{announcement.title}</TableCell>
              <TableCell className="capitalize">{(announcement.type || 'general').replace(/_/g, ' ')}</TableCell>
              <TableCell className="capitalize">{announcement.priority || 'normal'}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(announcement.status)}>{announcement.status || 'draft'}</Badge>
              </TableCell>
              <TableCell>{formatDate(announcement.publish_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
