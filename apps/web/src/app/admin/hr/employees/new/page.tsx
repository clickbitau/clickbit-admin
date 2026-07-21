'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { EmployeeForm } from '@/components/hr/EmployeeForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ArrowLeft } from 'lucide-react';

export default function AdminNewEmployeePage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Employee"
      icon={Users}
      description="Create an employee record linked to a user"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/employees"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader><CardTitle>Employee Details</CardTitle></CardHeader>
        <CardContent>
          <EmployeeForm token={token} onSuccess={(employee: any) => router.push(employee?.id ? `/admin/hr/employees/${employee.id}` : '/admin/hr/employees')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
