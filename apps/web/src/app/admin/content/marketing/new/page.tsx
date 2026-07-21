'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { MarketingPostForm } from '@/components/content/MarketingPostForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, TrendingUp } from 'lucide-react';

export default function AdminNewMarketingPostPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Marketing Post"
      icon={TrendingUp}
      description="Create a marketing update or announcement"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/content/marketing"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Post Details</CardTitle></CardHeader>
        <CardContent>
          <MarketingPostForm token={token} onSuccess={() => router.push('/admin/content/marketing')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
