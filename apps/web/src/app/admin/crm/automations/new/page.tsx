'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { AutomationForm } from '@/components/crm/AutomationForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Zap } from 'lucide-react';

export default function AdminNewAutomationPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Automation"
      icon={Zap}
      description="Create a CRM automation rule"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/crm/automations"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Automation Rule</CardTitle></CardHeader>
        <CardContent>
          <AutomationForm token={token} onSuccess={(automation: any) => router.push(automation?.id ? `/admin/crm/automations/${automation.id}` : '/admin/crm/automations')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
