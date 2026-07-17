'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchContacts } from '@/lib/crm-api';
import { Button } from '@/components/ui/button';
import type { Contact } from '@clickbit/shared';

export default function ContactsPage() {
  const router = useRouter();
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
      actions={<Button asChild><Link href="/admin/crm/contacts/new">New Contact</Link></Button>}
      onRowClick={(row) => router.push(`/admin/crm/contacts/${row.id}`)}
    />
  );
}
