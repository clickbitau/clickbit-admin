'use client';

import { Megaphone } from 'lucide-react';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/lib/api';

export default function AdminAnnouncementDetailPage() {
  return (
    <ResourceDetailPage
      title="Announcement"
      icon={Megaphone}
      backHref="/admin/hr/announcements"
      titleKey="title"
      getFn={(token, id) => fetchAnnouncement(token, id)}
      updateFn={(token, id, data) => updateAnnouncement(token, Number(id), data)}
      deleteFn={(token, id) => deleteAnnouncement(token, Number(id))}
      fields={[
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'content', label: 'Content', type: 'textarea' },
        { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'scheduled', 'archived'] },
        { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'normal', 'high', 'urgent'] },
        { key: 'target_department', label: 'Target department', type: 'text' },
        { key: 'scheduled_at', label: 'Scheduled at', type: 'date' },
      ]}
    />
  );
}
