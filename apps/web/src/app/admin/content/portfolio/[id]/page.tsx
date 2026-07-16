'use client';

import { Folder } from 'lucide-react';
import { ContentDetailPage } from '@/components/content/ContentDetailPage';
import { fetchAdminPortfolioItem, updatePortfolioItem, deletePortfolioItem } from '@/lib/api';

export default function AdminPortfolioItemDetailPage() {
  return (
    <ContentDetailPage
      title="Portfolio item"
      icon={Folder}
      backHref="/admin/content/portfolio"
      titleKey="title"
      getFn={(token, id) => fetchAdminPortfolioItem(token, id)}
      updateFn={(token, id, data) => updatePortfolioItem(token, Number(id), data)}
      deleteFn={(token, id) => deletePortfolioItem(token, Number(id))}
      fields={[
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'slug', label: 'Slug', type: 'text' },
        { key: 'category', label: 'Category', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'short_description', label: 'Short description', type: 'textarea' },
        { key: 'client_name', label: 'Client name', type: 'text' },
        { key: 'project_url', label: 'Project URL', type: 'text' },
        { key: 'project_date', label: 'Project date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'archived'] },
        { key: 'featured', label: 'Featured', type: 'checkbox' },
        { key: 'sort_order', label: 'Sort order', type: 'number' },
      ]}
    />
  );
}
