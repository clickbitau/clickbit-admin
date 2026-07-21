'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { TimeOffForm } from '@/components/hr/TimeOffForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar } from 'lucide-react';

export default function AdminNewTimeOffPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Time Off"
      icon={Calendar}
      description="Submit a leave request on behalf of an employee"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/time-off"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader><CardTitle>Leave Request</CardTitle></CardHeader>
        <CardContent>
          <TimeOffForm token={token} onSuccess={(timeOff: any) => router.push(timeOff?.id ? `/admin/hr/time-off/${timeOff.id}` : '/admin/hr/time-off')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
