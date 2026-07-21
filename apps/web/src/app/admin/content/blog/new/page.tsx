'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { BlogPostForm } from '@/components/content/BlogPostForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, BookOpen } from 'lucide-react';

export default function AdminNewBlogPostPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Blog Post"
      icon={BookOpen}
      description="Create a new blog article"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/content/blog"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Post Details</CardTitle></CardHeader>
        <CardContent>
          <BlogPostForm token={token} onSuccess={() => router.push('/admin/content/blog')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
