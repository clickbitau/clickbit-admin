'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { ActivityForm } from '@/components/crm/ActivityForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity as ActivityIcon, ArrowLeft } from 'lucide-react';

export default function AdminNewActivityPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Activity"
      icon={ActivityIcon}
      description="Log a task, call, meeting, or follow-up"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/crm/activities"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Activity Details</CardTitle></CardHeader>
        <CardContent>
          <ActivityForm token={token} onSuccess={() => router.push('/admin/crm/activities')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
