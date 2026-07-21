'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { TeamMemberForm } from '@/components/content/TeamMemberForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users } from 'lucide-react';

export default function AdminNewTeamMemberPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Team Member"
      icon={Users}
      description="Add a team member to the public site"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/content/team"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Member Details</CardTitle></CardHeader>
        <CardContent>
          <TeamMemberForm token={token} onSuccess={() => router.push('/admin/content/team')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
