'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { ContentListPage } from '@/components/content/ContentListPage';
import { fetchAdminReviews, updateReviewStatus, updateReview, deleteReview } from '@/lib/api';
import type { Review } from '@clickbit/shared/src/content';
import { toast } from 'sonner';

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

export default function AdminContentReviewsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminReviews(token, {}); },
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

  const statCards = [
    { label: 'Total Reviews', value: stats.total, icon: MessageSquare },
    { label: 'Pending', value: stats.pending, icon: Clock, accent: 'warning' as const },
    { label: 'Approved', value: stats.approved, icon: CheckCircle2, accent: 'success' as const },
    { label: 'Avg Rating', value: stats.averageRating, icon: Star, accent: 'primary' as const },
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
    (r.company || '').toLowerCase().includes(q) ||
    (r.review_text || '').toLowerCase().includes(q);

  const setStatus = (r: Review, status: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
    <div className="nm-raised rounded-xl p-5 overflow-hidden group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{r.name}</h3>
          <p className="text-sm text-muted-foreground">{r.company || 'No company'} · {r.position || 'No position'}</p>
          <div className="mt-2"><StarRating rating={r.rating || 0} /></div>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${statusBadge(r.status)}`}>{r.status}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-3 line-clamp-3">&ldquo;{r.review_text}&rdquo;</p>
      <div className="flex items-center justify-between mt-4">
        <button
          type="button"
          onClick={(e) => toggleFeaturedItem(r, e)}
          disabled={toggleFeatured.isPending}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${r.is_featured ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400'}`}
        >
          <Star className={`h-3.5 w-3.5 ${r.is_featured ? 'fill-current' : ''}`} /> {r.is_featured ? 'Featured' : 'Not featured'}
        </button>
        <div className="flex items-center gap-1">
          {r.status !== 'approved' && (
            <button type="button" onClick={(e) => setStatus(r, 'approved', e)} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"><ThumbsUp className="h-4 w-4" /></button>
          )}
          {r.status !== 'rejected' && (
            <button type="button" onClick={(e) => setStatus(r, 'rejected', e)} className="p-1.5 rounded-md text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20"><ThumbsDown className="h-4 w-4" /></button>
          )}
          <Link href={`/admin/content/reviews/${r.id}`} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-all"><Edit className="h-4 w-4" /></Link>
          <button type="button" onClick={(e) => handleDelete(r, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-all"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );

  const renderTableRow = (r: Review) => [
    <td key="name" className="px-4 py-4">
      <div>
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted-foreground">{r.company || '—'}</div>
        <div className="mt-1"><StarRating rating={r.rating || 0} /></div>
      </div>
    </td>,
    <td key="text" className="px-4 py-4">
      <p className="text-sm text-muted-foreground line-clamp-2 max-w-xs">{r.review_text}</p>
    </td>,
    <td key="status" className="px-4 py-4">
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${statusBadge(r.status)}`}>{r.status}</span>
    </td>,
    <td key="featured" className="px-4 py-4 text-center">
      <button type="button" onClick={(e) => toggleFeaturedItem(r, e)} className={`p-1.5 rounded-md transition-all ${r.is_featured ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-500/20' : 'text-muted-foreground'}`}>
        <Star className={`h-4 w-4 ${r.is_featured ? 'fill-current' : ''}`} />
      </button>
    </td>,
    <td key="actions" className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-1">
        {r.status !== 'approved' && <button type="button" onClick={(e) => setStatus(r, 'approved', e)} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"><ThumbsUp className="h-4 w-4" /></button>}
        {r.status !== 'rejected' && <button type="button" onClick={(e) => setStatus(r, 'rejected', e)} className="p-1.5 rounded-md text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20"><ThumbsDown className="h-4 w-4" /></button>}
        <Link href={`/admin/content/reviews/${r.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Edit className="h-4 w-4" /></Link>
        <button type="button" onClick={(e) => handleDelete(r, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
    </td>,
  ];

  return (
    <ContentListPage
      title="Reviews"
      icon={Star}
      newHref="/admin/content/reviews/new"
      newLabel="New Review"
      items={items}
      isLoading={isLoading}
      statCards={statCards}
      searchPlaceholder="Search reviews..."
      searchFn={searchFn}
      filterTabs={filterTabs}
      tableHeaders={[{ key: 'name', label: 'Reviewer' }, { key: 'text', label: 'Review' }, { key: 'status', label: 'Status' }, { key: 'featured', label: 'Featured', className: 'text-center' }, { key: 'actions', label: '', className: 'text-right' }]}
      renderGridCard={renderGridCard}
      renderTableRow={renderTableRow}
      onRowClick={(r) => router.push(`/admin/content/reviews/${r.id}`)}
      emptyText="No reviews found."
    />
  );
}
