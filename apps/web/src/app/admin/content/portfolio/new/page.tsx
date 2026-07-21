'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { PortfolioForm } from '@/components/content/PortfolioForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FolderKanban } from 'lucide-react';

export default function AdminNewPortfolioPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Portfolio Item"
      icon={FolderKanban}
      description="Add a project to the portfolio"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/content/portfolio"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
        <CardContent>
          <PortfolioForm token={token} onSuccess={() => router.push('/admin/content/portfolio')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
