'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StaffAdvanceForm } from '@/components/finance/StaffAdvanceForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, HandCoins } from 'lucide-react';

export default function NewStaffAdvancePage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Staff Advance"
      icon={HandCoins}
      description="Create an employee advance, loan or asset advance"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/finance/staff-advances"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Advance Details</CardTitle></CardHeader>
        <CardContent>
          <StaffAdvanceForm token={token} onSuccess={(advance: any) => router.push(advance?.id ? `/admin/finance/staff-advances/${advance.id}` : '/admin/finance/staff-advances')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
