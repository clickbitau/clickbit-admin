'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAnnouncement } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Megaphone, ArrowLeft, Pin } from 'lucide-react';
import Link from 'next/link';

export default function EmployeeAnnouncementDetailPage() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['employee-announcement', token, id],
    queryFn: async () => {
      if (!token || !id) throw new Error('Missing token or id');
      const res: any = await fetchAnnouncement(token, id);
      return res.data || res;
    },
    enabled: !!token && !!id,
  });

  const announcement = data;

  return (
    <PageShell
      title={announcement?.title || 'Announcement'}
      icon={Megaphone}
      description="Company news and updates"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/employee/announcements"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !announcement ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">Announcement not found.</Card>
      ) : (
        <Card className="nm-raised">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              {announcement.is_pinned && <Pin className="h-4 w-4 text-primary" />}
              {announcement.title}
            </CardTitle>
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${priorityClass(announcement.priority)}`}>
              {announcement.priority || 'general'}
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: announcement.content_html || announcement.content }}
            />
            <p className="text-xs text-muted-foreground">Published {formatDate(announcement.publish_at || announcement.created_at)}</p>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}

function priorityClass(priority?: string | null) {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'high': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'medium': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}
