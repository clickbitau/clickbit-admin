'use client';

import Link from 'next/link';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchNotes } from '@/lib/crm-api';
import { Button } from '@/components/ui/button';
import type { CrmNote } from '@clickbit/shared';

export default function NotesPage() {
  return (
    <ResourceListPage<CrmNote>
      title="Notes"
      resourceKey="notes"
      fetcher={fetchNotes as any}
      getRowId={(row) => row.id}
      columns={[
        { key: 'content', header: 'Content' },
        { key: 'note_type', header: 'Type' },
        { key: 'created_at', header: 'Created' },
      ]}
      actions={<Button asChild><Link href="/admin/crm/notes/new">New Note</Link></Button>}
    />
  );
}
