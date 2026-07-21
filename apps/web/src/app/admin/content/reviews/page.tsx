'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Star,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  User,
  Briefcase,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ContentListPage } from '@/components/content/ContentListPage';
import { ReviewForm } from '@/components/content/ReviewForm';
import { fetchAdminReviews, updateReviewStatus, updateReview, deleteReview } from '@/lib/api';
import type { Review } from '@clickbit/shared/src/content';
import { toast } from 'sonner';

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const statusBadge = (status?: string) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  };
  return map[status || ''] || 'bg-gray-100 text-gray-700';
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
      ))}
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-AU');
}

export default function AdminContentReviewsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminReviews(token, { status: 'all', limit: 1000 }); },
    enabled: !!token,
  });

  const items = data?.reviews ?? [];
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

  const [createOpen, setCreateOpen] = useState(false);

  const statCards = [
    { label: 'Total Reviews', value: stats.total, icon: MessageSquare },
    { label: 'Pending', value: stats.pending, icon: Clock, accent: 'warning' as const },
    { label: 'Approved', value: stats.approved, icon: CheckCircle2, accent: 'success' as const },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, accent: 'destructive' as const },
    { label: 'Featured', value: stats.featured, icon: Star, accent: 'primary' as const },
  ];

  const filterTabs = [
    { id: 'all', label: 'All', filter: () => true },
    { id: 'pending', label: 'Pending', filter: (r: Review) => r.status === 'pending', activeClassName: 'bg-amber-600 text-white' },
    { id: 'approved', label: 'Approved', filter: (r: Review) => r.status === 'approved', activeClassName: 'bg-emerald-600 text-white' },
    { id: 'rejected', label: 'Rejected', filter: (r: Review) => r.status === 'rejected', activeClassName: 'bg-red-600 text-white' },
    { id: 'featured', label: 'Featured', filter: (r: Review) => !!r.is_featured, activeClassName: 'bg-yellow-500 text-white' },
  ];

  const searchFn = (r: Review, q: string) =>
    (r.name || '').toLowerCase().includes(q) ||
    (r.email || '').toLowerCase().includes(q) ||
    (r.company || '').toLowerCase().includes(q) ||
    (r.position || '').toLowerCase().includes(q) ||
    (r.review_text || '').toLowerCase().includes(q) ||
    (r.service_type || '').toLowerCase().includes(q) ||
    (r.project_type || '').toLowerCase().includes(q);

  const setStatus = (r: Review, status: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (status === r.status) return;
    updateStatus.mutate({ id: r.id, status });
  };

  const toggleFeaturedItem = (r: Review, e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleFeatured.mutate({ id: r.id, is_featured: !r.is_featured });
  };

  const handleDelete = (r: Review, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Delete this review?')) return;
    remove.mutate(r.id);
  };

  const renderGridCard = (r: Review) => (
    <div className="nm-raised rounded-xl p-5 overflow-hidden group h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{r.name}</h3>
          <p className="text-sm text-muted-foreground">
            {r.position && r.company ? `${r.position} at ${r.company}` : r.position || r.company || 'No company'}
          </p>
          {r.email && <p className="text-xs text-muted-foreground truncate">{r.email}</p>}
          <div className="mt-2"><StarRating rating={r.rating || 0} /></div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${statusBadge(r.status)}`}>{r.status}</span>
          {r.is_featured && <Badge variant="secondary" className="text-xs">Featured</Badge>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-3 line-clamp-3">&ldquo;{r.review_text}&rdquo;</p>
      <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
        {r.service_type && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> {r.service_type}</span>}
        {r.project_type && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {r.project_type}</span>}
        {r.approved_at && <span>Approved {formatDate(r.approved_at)}</span>}
      </div>
      <div className="flex items-center justify-between mt-auto pt-4">
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {r.status !== 'approved' && (
            <button type="button" onClick={(e) => setStatus(r, 'approved', e)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 transition-all">
              <ThumbsUp className="h-3.5 w-3.5" /> Approve
            </button>
          )}
          {r.status !== 'rejected' && (
            <button type="button" onClick={(e) => setStatus(r, 'rejected', e)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-400 transition-all">
              <ThumbsDown className="h-3.5 w-3.5" /> Reject
            </button>
          )}
          {r.status === 'approved' && (
            <button type="button" onClick={(e) => toggleFeaturedItem(r, e)} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${r.is_featured ? 'text-yellow-700 bg-yellow-100 dark:bg-yellow-500/20 dark:text-yellow-400' : 'text-muted-foreground bg-gray-100 dark:bg-gray-500/10'}`}>
              <Star className={`h-3.5 w-3.5 ${r.is_featured ? 'fill-current' : ''}`} /> {r.is_featured ? 'Unfeature' : 'Feature'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Link href={`/admin/content/reviews/${r.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Edit className="h-4 w-4" /></Link>
          <button type="button" onClick={(e) => handleDelete(r, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );

  const renderTableRow = (r: Review) => [
    <td key="reviewer" className="px-4 py-4">
      <div>
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted-foreground">{r.email || (r.company || '—')}</div>
        {(r.position || r.company) && <div className="text-xs text-muted-foreground">{r.position && r.company ? `${r.position} at ${r.company}` : r.position || r.company}</div>}
        <div className="mt-1"><StarRating rating={r.rating || 0} /></div>
      </div>
    </td>,
    <td key="text" className="px-4 py-4">
      <p className="text-sm text-muted-foreground line-clamp-3 max-w-sm">&ldquo;{r.review_text}&rdquo;</p>
      <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
        {r.service_type && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> {r.service_type}</span>}
        {r.project_type && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {r.project_type}</span>}
      </div>
    </td>,
    <td key="status" className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
      <select value={r.status} onChange={(e) => setStatus(r, e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
        {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {r.approved_at && <div className="text-[10px] text-muted-foreground mt-1">{formatDate(r.approved_at)}</div>}
    </td>,
    <td key="featured" className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={(e) => toggleFeaturedItem(r, e)} className={`p-1.5 rounded-md transition-all ${r.is_featured ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-500/20' : 'text-muted-foreground'}`}>
        <Star className={`h-4 w-4 ${r.is_featured ? 'fill-current' : ''}`} />
      </button>
    </td>,
    <td key="actions" className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-1">
        <Link href={`/admin/content/reviews/${r.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Edit className="h-4 w-4" /></Link>
        <button type="button" onClick={(e) => handleDelete(r, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
    </td>,
  ];

  return (
    <ContentListPage
      title="Reviews"
      description="Manage customer reviews and testimonials."
      icon={Star}
      actions={<Button onClick={() => setCreateOpen(true)} className="gap-1"><Plus className="h-4 w-4" /> New Review</Button>}
      items={items}
      isLoading={isLoading}
      statCards={statCards}
      searchPlaceholder="Search reviewers, text, service or project..."
      searchFn={searchFn}
      filterTabs={filterTabs}
      pageSize={10}
      tableHeaders={[{ key: 'reviewer', label: 'Reviewer' }, { key: 'text', label: 'Review' }, { key: 'status', label: 'Status' }, { key: 'featured', label: 'Featured', className: 'text-center' }, { key: 'actions', label: '', className: 'text-right' }]}
      renderGridCard={renderGridCard}
      renderTableRow={renderTableRow}
      onRowClick={(r) => router.push(`/admin/content/reviews/${r.id}`)}
      emptyText="No reviews found."
      footer={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Review</DialogTitle>
              <DialogDescription>Add a testimonial or customer review.</DialogDescription>
            </DialogHeader>
            {token && (
              <ReviewForm
                token={token}
                onSuccess={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }); }}
                onCancel={() => setCreateOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      }
    />
  );
}
