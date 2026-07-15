'use client';

import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchContacts } from '@/lib/crm-api';
import type { Contact } from '@clickbit/shared';

export default function ContactsPage() {
  return (
    <ResourceListPage<Contact>
      title="Contacts"
      resourceKey="contacts"
      fetcher={fetchContacts as any}
      getRowId={(row) => row.id}
      columns={[
        { key: 'name', header: 'Name' },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: 'Phone' },
        { key: 'job_title', header: 'Job Title' },
        { key: 'lifecycle_stage', header: 'Lifecycle Stage' },
        { key: 'created_at', header: 'Created' },
      ]}
    />
  );
}
