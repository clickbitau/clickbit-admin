'use client';

import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchNotes } from '@/lib/crm-api';
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
    />
  );
}
