'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { LeadForm } from '@/components/crm/LeadForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, ArrowLeft } from 'lucide-react';

export default function AdminNewLeadPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Lead"
      icon={UserPlus}
      description="Create a new sales lead"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/crm/leads"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Lead Details</CardTitle></CardHeader>
        <CardContent>
          <LeadForm token={token} onSuccess={(lead: any) => router.push(lead?.id ? `/admin/crm/leads/${lead.id}` : '/admin/crm/leads')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
