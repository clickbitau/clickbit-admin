'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { ServiceForm } from '@/components/content/ServiceForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Briefcase } from 'lucide-react';

export default function AdminNewServicePage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Service"
      icon={Briefcase}
      description="Add a service to the public site"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/content/services"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Service Details</CardTitle></CardHeader>
        <CardContent>
          <ServiceForm token={token} onSuccess={() => router.push('/admin/content/services')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
