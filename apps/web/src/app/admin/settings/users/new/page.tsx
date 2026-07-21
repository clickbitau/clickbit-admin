'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { UserForm } from '@/components/settings/UserForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, User as UserIcon } from 'lucide-react';

export default function AdminNewUserPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New User"
      icon={UserIcon}
      description="Create a user profile and account"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/settings/users"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>User Details</CardTitle></CardHeader>
        <CardContent>
          <UserForm token={token} onSuccess={() => router.push('/admin/settings/users')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
