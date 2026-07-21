'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { PublicHolidayForm } from '@/components/hr/PublicHolidayForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar } from 'lucide-react';

export default function AdminNewPublicHolidayPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Public Holiday"
      icon={Calendar}
      description="Add a public holiday to the calendar"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/public-holidays"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader><CardTitle>Public Holiday</CardTitle></CardHeader>
        <CardContent>
          <PublicHolidayForm token={token} onSuccess={(holiday: any) => router.push(holiday?.id ? `/admin/hr/public-holidays/${holiday.id}` : '/admin/hr/public-holidays')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
