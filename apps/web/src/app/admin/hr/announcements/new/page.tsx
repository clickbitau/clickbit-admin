'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { AnnouncementForm } from '@/components/hr/AnnouncementForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Megaphone } from 'lucide-react';

export default function AdminNewAnnouncementPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Announcement"
      icon={Megaphone}
      description="Publish a company-wide announcement"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/announcements"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader><CardTitle>Announcement</CardTitle></CardHeader>
        <CardContent>
          <AnnouncementForm token={token} onSuccess={(announcement: any) => router.push(announcement?.id ? `/admin/hr/announcements/${announcement.id}` : '/admin/hr/announcements')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
