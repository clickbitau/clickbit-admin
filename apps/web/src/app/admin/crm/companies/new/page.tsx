'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { CompanyForm } from '@/components/crm/CompanyForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ArrowLeft } from 'lucide-react';

export default function AdminNewCompanyPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Company"
      icon={Building2}
      description="Add a new business account"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/crm/companies"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Company Details</CardTitle></CardHeader>
        <CardContent>
          <CompanyForm token={token} onSuccess={(company: any) => router.push(company?.id ? `/admin/crm/companies/${company.id}` : '/admin/crm/companies')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
