'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { ReminderForm } from '@/components/hr/ReminderForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Bell } from 'lucide-react';

export default function AdminNewReminderPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Reminder"
      icon={Bell}
      description="Schedule a reminder for a person or event"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/reminders"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader><CardTitle>Reminder</CardTitle></CardHeader>
        <CardContent>
          <ReminderForm token={token} onSuccess={(reminder: any) => router.push(reminder?.id ? `/admin/hr/reminders/${reminder.id}` : '/admin/hr/reminders')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
