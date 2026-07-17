'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { submitReview } from '@/lib/api';
import type { Review } from '@clickbit/shared';
import { ArrowLeft, Plus, Star } from 'lucide-react';

export default function AdminNewReviewPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<Review>>({
    name: '',
    email: '',
    company: '',
    position: '',
    rating: 5,
    review_text: '',
    service_type: '',
    project_type: '',
  });

  const mutation = useMutation({
    mutationFn: () => submitReview({ ...form, rating: Number(form.rating || 5) } as Partial<Review>),
    onSuccess: (data: any) => {
      toast.success('Review submitted');
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      const id = data?.review?.id || data?.data?.id || data?.id;
      router.push(id ? `/admin/content/reviews/${id}` : '/admin/content/reviews');
    },
    onError: () => toast.error('Failed to submit review'),
  });

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
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Author name</Label><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Rating</Label>
            <select value={form.rating || 5} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r} stars</option>)}
            </select>
          </div>
          <div><Label>Company</Label><Input value={form.company || ''} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          <div><Label>Position</Label><Input value={form.position || ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Review</Label><Textarea value={form.review_text || ''} onChange={(e) => setForm({ ...form, review_text: e.target.value })} rows={4} /></div>
          <div><Label>Service type</Label><Input value={form.service_type || ''} onChange={(e) => setForm({ ...form, service_type: e.target.value })} /></div>
          <div><Label>Project type</Label><Input value={form.project_type || ''} onChange={(e) => setForm({ ...form, project_type: e.target.value })} /></div>
          <div className="md:col-span-2">
            <Button onClick={() => form.name && form.review_text && mutation.mutate()} disabled={mutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Submit Review
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
