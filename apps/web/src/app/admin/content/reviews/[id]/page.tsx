'use client';

import { Star } from 'lucide-react';
import { ContentDetailPage } from '@/components/content/ContentDetailPage';
import { fetchAdminReview, updateReview, deleteReview } from '@/lib/api';

export default function AdminReviewDetailPage() {
  return (
    <ContentDetailPage
      title="Review"
      icon={Star}
      backHref="/admin/content/reviews"
      titleKey="name"
      getFn={(token, id) => fetchAdminReview(token, id)}
      updateFn={(token, id, data) => updateReview(token, Number(id), data)}
      deleteFn={(token, id) => deleteReview(token, Number(id))}
      fields={[
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'company', label: 'Company', type: 'text' },
        { key: 'position', label: 'Position', type: 'text' },
        { key: 'rating', label: 'Rating', type: 'number' },
        { key: 'review_text', label: 'Review text', type: 'textarea' },
        { key: 'status', label: 'Status', type: 'select', options: ['pending', 'approved', 'rejected'] },
        { key: 'is_featured', label: 'Featured', type: 'checkbox' },
      ]}
    />
  );
}
