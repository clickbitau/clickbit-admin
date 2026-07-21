'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { NoteForm } from '@/components/crm/NoteForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, StickyNote } from 'lucide-react';

export default function AdminNewNotePage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Note"
      icon={StickyNote}
      description="Create a CRM note linked to a contact, company, deal or activity"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/crm/notes"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Note</CardTitle></CardHeader>
        <CardContent>
          <NoteForm token={token} onSuccess={(note: any) => router.push(note?.id ? `/admin/crm/notes/${note.id}` : '/admin/crm/notes')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
