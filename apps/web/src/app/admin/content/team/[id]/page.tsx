'use client';

import { Users } from 'lucide-react';
import { ContentDetailPage } from '@/components/content/ContentDetailPage';
import { fetchTeamMember, updateTeamMember, deleteTeamMember } from '@/lib/api';

export default function AdminTeamMemberDetailPage() {
  return (
    <ContentDetailPage
      title="Team member"
      icon={Users}
      backHref="/admin/content/team"
      titleKey="name"
      getFn={(token, id) => fetchTeamMember(token, id)}
      updateFn={(token, id, data) => updateTeamMember(token, Number(id), data)}
      deleteFn={(token, id) => deleteTeamMember(token, Number(id))}
      fields={[
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'role', label: 'Role', type: 'text' },
        { key: 'role_label', label: 'Role label', type: 'text' },
        { key: 'image', label: 'Photo', type: 'image', upload: 'team' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'text' },
        { key: 'bio', label: 'Bio', type: 'textarea' },
        { key: 'linkedin', label: 'LinkedIn', type: 'text' },
        { key: 'display_order', label: 'Display order', type: 'number' },
        { key: 'is_active', label: 'Active', type: 'checkbox' },
      ]}
    />
  );
}
