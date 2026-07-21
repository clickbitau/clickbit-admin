'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { ProjectForm } from '@/components/crm/ProjectForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FolderKanban } from 'lucide-react';

export default function AdminNewProjectPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Project"
      icon={FolderKanban}
      description="Create a CRM project linked to a customer or company"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/crm/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
        <CardContent>
          <ProjectForm token={token} onSuccess={(project: any) => router.push(project?.id ? `/admin/crm/projects/${project.id}` : '/admin/crm/projects')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
