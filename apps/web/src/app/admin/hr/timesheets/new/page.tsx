'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { TimesheetForm } from '@/components/hr/TimesheetForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileClock } from 'lucide-react';

export default function AdminNewTimesheetPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Timesheet Entry"
      icon={FileClock}
      description="Manually add a clock-in/out entry for an employee"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/timesheets"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader><CardTitle>Manual Entry</CardTitle></CardHeader>
        <CardContent>
          <TimesheetForm token={token} onSuccess={(timesheet: any) => router.push(timesheet?.id ? `/admin/hr/timesheets/${timesheet.id}` : '/admin/hr/timesheets')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
