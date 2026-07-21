'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bug, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { BugReportForm } from '@/components/bug-reports/BugReportForm';
import { Button } from '@/components/ui/button';

export default function NewBugReportPage() {
  const { token, user } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Bug Report"
      icon={Bug}
      description="Manually file a bug report and route it to the right repository"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/bug-reports"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <BugReportForm token={token} user={user} onSuccess={(report: any) => router.push(report?.id ? `/admin/bug-reports/${report.id}` : '/admin/bug-reports')} />
    </PageShell>
  );
}
