'use client';

import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchCustomerTask } from '@/lib/api';
import { ListTodo } from 'lucide-react';

export default function CustomerTaskDetailPage() {
  return (
    <ResourceDetailPage
      title="Task"
      icon={ListTodo}
      backHref="/customer/tasks"
      titleKey="title"
      getFn={(token, id) => fetchCustomerTask(token, id).then((r) => r.data)}
      fields={[
        { key: 'title', label: 'Title', type: 'text', readOnly: true },
        { key: 'status', label: 'Status', type: 'text', readOnly: true },
        { key: 'priority', label: 'Priority', type: 'text', readOnly: true },
        { key: 'estimated_hours', label: 'Estimated Hours', type: 'number', readOnly: true },
        { key: 'actual_hours', label: 'Actual Hours', type: 'number', readOnly: true },
        { key: 'start_date', label: 'Start', type: 'date', readOnly: true },
        { key: 'due_date', label: 'Due', type: 'date', readOnly: true },
        { key: 'completed_at', label: 'Completed', type: 'date', readOnly: true },
        { key: 'description', label: 'Description', type: 'textarea', readOnly: true },
      ]}
    />
  );
}
