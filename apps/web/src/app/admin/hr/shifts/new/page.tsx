'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { ShiftForm } from '@/components/hr/ShiftForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar } from 'lucide-react';

export default function AdminNewShiftPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Shift"
      icon={Calendar}
      description="Add an employee shift to the roster"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/shifts"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader><CardTitle>Shift Details</CardTitle></CardHeader>
        <CardContent>
          <ShiftForm token={token} onSuccess={(shift: any) => router.push(shift?.id ? `/admin/hr/shifts/${shift.id}` : '/admin/hr/shifts')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
