'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { ContractForm } from '@/components/hr/ContractForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText } from 'lucide-react';

export default function AdminNewContractPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Contract"
      icon={FileText}
      description="Create an employee contract"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/contracts"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader><CardTitle>Contract Details</CardTitle></CardHeader>
        <CardContent>
          <ContractForm token={token} onSuccess={(contract: any) => router.push(contract?.id ? `/admin/hr/contracts/${contract.id}` : '/admin/hr/contracts')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
