'use client';

import { Bell } from 'lucide-react';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchReminder, updateReminder, deleteReminder } from '@/lib/api';

export default function AdminReminderDetailPage() {
  return (
    <ResourceDetailPage
      title="Reminder"
      icon={Bell}
      backHref="/admin/hr/reminders"
      titleKey="title"
      getFn={(token, id) => fetchReminder(token, id)}
      updateFn={(token, id, data) => updateReminder(token, Number(id), data)}
      deleteFn={(token, id) => deleteReminder(token, Number(id))}
      fields={[
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'status', label: 'Status', type: 'select', options: ['pending', 'sent', 'completed', 'cancelled'] },
        { key: 'reminder_date', label: 'Reminder date', type: 'date' },
        { key: 'send_email', label: 'Send email', type: 'checkbox' },
      ]}
    />
  );
}
