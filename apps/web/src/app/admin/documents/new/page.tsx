'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DocumentForm } from '@/components/documents/DocumentForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileUp } from 'lucide-react';

export default function AdminNewDocumentPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="Upload Document"
      icon={FileUp}
      description="Upload a new file and set its metadata"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/documents"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Document Upload</CardTitle></CardHeader>
        <CardContent>
          <DocumentForm token={token} onSuccess={(document: any) => router.push(document?.id ? `/admin/documents/${document.id}` : '/admin/documents')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
