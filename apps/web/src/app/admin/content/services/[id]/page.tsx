'use client';

import { Briefcase } from 'lucide-react';
import { ContentDetailPage } from '@/components/content/ContentDetailPage';
import { fetchAdminService, updateService, deleteService } from '@/lib/api';

export default function AdminServiceDetailPage() {
  return (
    <ContentDetailPage
      title="Service"
      icon={Briefcase}
      backHref="/admin/content/services"
      titleKey="name"
      getFn={(token, id) => fetchAdminService(token, id)}
      updateFn={(token, id, data) => updateService(token, Number(id), data)}
      deleteFn={(token, id) => deleteService(token, Number(id))}
      fields={[
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'slug', label: 'Slug', type: 'text' },
        { key: 'category', label: 'Category', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'header_image', label: 'Header image', type: 'image' },
        { key: 'features', label: 'Features', type: 'json' },
        { key: 'pricing', label: 'Pricing', type: 'json' },
        { key: 'sections', label: 'Sections', type: 'json' },
        { key: 'is_popular', label: 'Popular', type: 'checkbox' },
        { key: 'is_active', label: 'Active', type: 'checkbox' },
      ]}
    />
  );
}
