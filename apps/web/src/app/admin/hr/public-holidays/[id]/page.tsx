'use client';

import { CalendarDays } from 'lucide-react';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchPublicHoliday, updatePublicHoliday, deletePublicHoliday } from '@/lib/api';

export default function AdminPublicHolidayDetailPage() {
  return (
    <ResourceDetailPage
      title="Public holiday"
      icon={CalendarDays}
      backHref="/admin/hr/public-holidays"
      titleKey="name"
      getFn={async (token, id) => {
        const response = await fetchPublicHoliday(token, id);
        return response.data;
      }}
      updateFn={async (token, id, data) => {
        const response = await updatePublicHoliday(token, Number(id), data);
        return response.data;
      }}
      deleteFn={(token, id) => deletePublicHoliday(token, Number(id))}
      fields={[
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'holiday_date', label: 'Holiday date', type: 'date' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'is_recurring', label: 'Recurring', type: 'checkbox' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
    />
  );
}
