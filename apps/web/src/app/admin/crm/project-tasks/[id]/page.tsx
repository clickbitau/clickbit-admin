'use client';

import { ListTodo } from 'lucide-react';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchTask, updateTask, deleteTask } from '@/lib/api';

export default function AdminProjectTaskDetailPage() {
  return (
    <ResourceDetailPage
      title="Task"
      icon={ListTodo}
      backHref="/admin/crm/project-tasks"
      titleKey="title"
      getFn={(token, id) => fetchTask(token, id)}
      updateFn={(token, id, data) => updateTask(token, Number(id), data)}
      deleteFn={(token, id) => deleteTask(token, Number(id))}
      fields={[
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'status', label: 'Status', type: 'select', options: ['todo', 'in_progress', 'review', 'completed', 'blocked'] },
        { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
        { key: 'estimated_hours', label: 'Estimated hours', type: 'number' },
        { key: 'actual_hours', label: 'Actual hours', type: 'number' },
        { key: 'due_date', label: 'Due date', type: 'date' },
        { key: 'start_date', label: 'Start date', type: 'date' },
        { key: 'position', label: 'Position', type: 'number' },
      ]}
    />
  );
}
