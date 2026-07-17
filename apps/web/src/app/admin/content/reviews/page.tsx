'use client';
import Link from 'next/link';
import { Plus, Star as StarIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAdminReviews, updateReviewStatus, deleteReview } from '@/lib/api';
import type { Review } from '@/types/content';

export default function AdminContentReviewsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('all');
  const { data, isLoading } = useQuery({ queryKey: ['admin-reviews', token, status], queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminReviews(token, { status }); }, enabled: !!token });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateReviewStatus(token!, id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reviews', token] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteReview(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reviews', token] }),
  });

  return (
    <PageShell
      title="Reviews"
      icon={StarIcon}
      actions={<Button asChild><Link href="/admin/content/reviews/new"><Plus className="mr-1 h-4 w-4" /> New Review</Link></Button>}
    >
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        <option value="all">All</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="divide-y">
          {data?.reviews?.map((r: Review) => (
            <div key={r.id} className="flex items-start justify-between py-2">
              <div>
                <Link href={`/admin/content/reviews/${r.id}`} className="font-medium hover:underline">{r.name} &middot; {r.rating}/5</Link>
                <div className="text-sm text-muted-foreground">{r.status}</div>
                <div className="text-sm">{r.review_text}</div>
              </div>
              <div className="flex gap-2">
                {r.status !== 'approved' && <Button size="sm" onClick={() => update.mutate({ id: r.id, status: 'approved' })}>Approve</Button>}
                {r.status !== 'rejected' && <Button size="sm" variant="secondary" onClick={() => update.mutate({ id: r.id, status: 'rejected' })}>Reject</Button>}
                <Button size="sm" variant="destructive" onClick={() => remove.mutate(r.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}