'use client';

import { TrendingUp } from 'lucide-react';
import { ContentDetailPage } from '@/components/content/ContentDetailPage';
import { fetchMarketingPost, updateMarketingPost, deleteMarketingPost } from '@/lib/api';

export default function AdminMarketingPostDetailPage() {
  return (
    <ContentDetailPage
      title="Marketing post"
      icon={TrendingUp}
      backHref="/admin/content/marketing"
      titleKey="title"
      getFn={(token, id) => fetchMarketingPost(token, id)}
      updateFn={(token, id, data) => updateMarketingPost(token, Number(id), data)}
      deleteFn={(token, id) => deleteMarketingPost(token, Number(id))}
      fields={[
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'slug', label: 'Slug', type: 'text' },
        { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
        { key: 'content', label: 'Body', type: 'textarea' },
        { key: 'featured_image', label: 'Featured image', type: 'image' },
        { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'archived'] },
        { key: 'featured', label: 'Featured', type: 'checkbox' },
      ]}
    />
  );
}
