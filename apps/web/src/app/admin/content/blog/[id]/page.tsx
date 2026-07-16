'use client';

import { BookOpen } from 'lucide-react';
import { ContentDetailPage } from '@/components/content/ContentDetailPage';
import { fetchAdminBlogPost, updateBlogPost, deleteBlogPost } from '@/lib/api';

export default function AdminBlogPostDetailPage() {
  return (
    <ContentDetailPage
      title="Blog post"
      icon={BookOpen}
      backHref="/admin/content/blog"
      titleKey="title"
      getFn={(token, id) => fetchAdminBlogPost(token, id)}
      updateFn={(token, id, data) => updateBlogPost(token, Number(id), data)}
      deleteFn={(token, id) => deleteBlogPost(token, Number(id))}
      fields={[
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'slug', label: 'Slug', type: 'text' },
        { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
        { key: 'content', label: 'Content', type: 'textarea' },
        { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'scheduled', 'archived'] },
        { key: 'featured', label: 'Featured', type: 'checkbox' },
        { key: 'allow_comments', label: 'Allow comments', type: 'checkbox' },
      ]}
    />
  );
}
