'use client';

import { useState } from 'react';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchNotes } from '@/lib/crm-api';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { CrmNote } from '@clickbit/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { NoteForm } from '@/components/crm/NoteForm';

export default function NotesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { token } = useAuth();
  return (
    <>
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
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Note</Button>}
      />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
            <DialogDescription>Create a CRM note linked to a record.</DialogDescription>
          </DialogHeader>
          {token && (
            <NoteForm
              token={token}
              onSuccess={() => setCreateOpen(false)}
              onCancel={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
