'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Star as StarIcon, Search } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { StatCards } from '@/components/design-system/StatCards';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { fetchAdminReviews, updateReviewStatus, updateReview, deleteReview } from '@/lib/api';
import type { Review } from '@/types/content';

export default function AdminContentReviewsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', token, status],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminReviews(token, { status }); },
    enabled: !!token,
  });

  const reviews = useMemo(() => {
    const rows = data?.reviews ?? [];
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (r.name || '').toLowerCase().includes(q) || (r.company || '').toLowerCase().includes(q) || (r.review_text || '').toLowerCase().includes(q));
  }, [data, search]);

  const stats = (data?.stats || { total: 0, pending: 0, approved: 0, rejected: 0, featured: 0, averageRating: 0 }) as Record<string, number>;

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateReviewStatus(token!, id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }),
  });

  const toggleFeatured = useMutation({
    mutationFn: ({ id, is_featured }: { id: number; is_featured: boolean }) => updateReview(token!, id, { is_featured }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteReview(token!, id),
    onSuccess: () => { toast.success('Review deleted'); queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }); },
  });

  const statCards = [
    { label: 'Total Reviews', value: stats.total, icon: StarIcon },
    { label: 'Pending', value: stats.pending, icon: StarIcon, accent: 'warning' as const },
    { label: 'Approved', value: stats.approved, icon: StarIcon, accent: 'success' as const },
    { label: 'Avg Rating', value: stats.averageRating, icon: StarIcon, accent: 'primary' as const },
  ];

  return (
    <PageShell
      title="Reviews"
      icon={StarIcon}
      actions={
        <Button asChild>
          <Link href="/admin/content/reviews/new"><Plus className="mr-1 h-4 w-4" /> New Review</Link>
        </Button>
      }
    >
      <StatCards cards={statCards} />

      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-3 pt-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reviews..." className="pl-9" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </CardContent>
      </Card>

      <DataTable
        loading={isLoading}
        emptyText="No reviews found."
        headers={[
          { key: 'reviewer', label: 'Reviewer' },
          { key: 'rating', label: 'Rating' },
          { key: 'status', label: 'Status' },
          { key: 'featured', label: 'Featured' },
          { key: 'actions', label: '', className: 'text-right' },
        ]}
        data={reviews}
        keyExtractor={(r) => r.id}
        onRowClick={(r) => router.push(`/admin/content/reviews/${r.id}`)}
        renderRow={(r) => [
          <div key={r.id}>
            <div className="font-medium">{r.name}</div>
            <div className="text-xs text-muted-foreground">{r.company || 'No company'} &middot; {r.service_type || '—'}</div>
          </div>,
          <span key="rating" className="text-sm">{r.rating}/5</span>,
          <span key="status" className="text-sm capitalize">{r.status}</span>,
          <Button key="featured" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleFeatured.mutate({ id: r.id, is_featured: !r.is_featured }); }}>
            {r.is_featured ? 'Featured' : '—'}
          </Button>,
          <div key="actions" className="flex items-center justify-end gap-1">
            {r.status !== 'approved' && <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: r.id, status: 'approved' }); }}>Approve</Button>}
            {r.status !== 'rejected' && <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: r.id, status: 'rejected' }); }}>Reject</Button>}
            <Button variant="ghost" size="sm" asChild><Link href={`/admin/content/reviews/${r.id}`}>Edit</Link></Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) remove.mutate(r.id); }}>Delete</Button>
          </div>,
        ]}
      />
    </PageShell>
  );
}
