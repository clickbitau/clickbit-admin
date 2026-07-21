'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { ReviewForm } from '@/components/content/ReviewForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Star } from 'lucide-react';

export default function AdminNewReviewPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Review"
      icon={Star}
      description="Add a testimonial or customer review"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/content/reviews"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Review Details</CardTitle></CardHeader>
        <CardContent>
          <ReviewForm token={token} onSuccess={(review: any) => router.push(review?.id ? `/admin/content/reviews/${review.id}` : '/admin/content/reviews')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
