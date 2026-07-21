'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { ProjectTaskForm } from '@/components/crm/ProjectTaskForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FolderKanban } from 'lucide-react';

export default function AdminNewProjectTaskPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Project Task"
      icon={FolderKanban}
      description="Create a task inside a project"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/crm/project-tasks"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Task Details</CardTitle></CardHeader>
        <CardContent>
          <ProjectTaskForm token={token} onSuccess={(task: any) => router.push(task?.id ? `/admin/crm/project-tasks/${task.id}` : '/admin/crm/project-tasks')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
