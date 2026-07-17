'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { deleteDocument, fetchDocument, fetchDocumentSignedUrl } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { ArrowLeft, Download, FileText, Trash, Upload } from 'lucide-react';

function formatBytes(bytes?: number | null) {
  if (!bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export default function AdminDocumentDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['document', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const res = await fetchDocument(token, id);
      return res.document;
    },
    enabled: !!token && !!id,
  });

  const doc = data;

  const signedUrlMutation = useMutation({
    mutationFn: () => fetchDocumentSignedUrl(token!, id),
    onSuccess: (res) => { window.open(res.url, '_blank'); },
    onError: () => toast.error('Failed to generate signed URL'),
  });

  const remove = useMutation({
    mutationFn: () => deleteDocument(token!, id),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['documents', token] });
      router.push('/admin/documents');
    },
    onError: () => toast.error('Delete failed'),
  });

  if (error) {
    return (
      <PageShell title="Document" icon={FileText} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/documents"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load document.</div>
      </PageShell>
    );
  }

  const statCards = doc
    ? [
        { label: 'Size', value: formatBytes(doc.file_size), icon: FileText },
        { label: 'Type', value: (doc.file_type || 'unknown').toUpperCase(), icon: FileText },
        { label: 'Status', value: doc.status || 'active', icon: FileText, accent: doc.status === 'active' ? 'success' as const : 'warning' as const },
        { label: 'Uploaded', value: doc.created_at ? formatDateTime(doc.created_at) : '-', icon: Upload },
      ]
    : [];

  return (
    <PageShell
      title={doc ? doc.name || doc.original_name || `Document ${doc.id}` : 'Document'}
      icon={FileText}
      description={doc ? `${formatBytes(doc.file_size)} · ${doc.file_type || 'unknown'}` : ''}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/documents"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
          <Button variant="outline" size="sm" onClick={() => signedUrlMutation.mutate()} disabled={signedUrlMutation.isPending}><Download className="mr-1 h-4 w-4" /> Open / Download</Button>
          <Button variant="destructive" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash className="mr-1 h-4 w-4" /> Delete</Button>
        </div>
      }
    >
      {isLoading || !doc ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <StatCards cards={statCards} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{doc.name || doc.original_name || `Document ${doc.id}`}</CardTitle>
                      <p className="text-sm text-muted-foreground">{doc.file_type || 'unknown'} · {formatBytes(doc.file_size)}</p>
                    </div>
                    <Badge variant={doc.status === 'active' ? 'default' : 'secondary'}>{doc.status || 'active'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <p><span className="text-muted-foreground">Original name:</span> {doc.original_name || '—'}</p>
                    <p><span className="text-muted-foreground">Type:</span> {doc.file_type || '—'}</p>
                    <p><span className="text-muted-foreground">Size:</span> {formatBytes(doc.file_size)}</p>
                    <p><span className="text-muted-foreground">Status:</span> {doc.status || 'active'}</p>
                    <p><span className="text-muted-foreground">Related entity:</span> {doc.related_entity_type ? `${doc.related_entity_type} #${doc.related_entity_id}` : '—'}</p>
                    <p><span className="text-muted-foreground">Uploaded by:</span> {doc.uploader?.name || doc.uploader?.email || `User ${doc.uploaded_by || '—'}`}</p>
                    <p><span className="text-muted-foreground">Created:</span> {doc.created_at ? formatDateTime(doc.created_at) : '—'}</p>
                    <p><span className="text-muted-foreground">Updated:</span> {doc.updated_at ? formatDateTime(doc.updated_at) : '—'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full" onClick={() => signedUrlMutation.mutate()} disabled={signedUrlMutation.isPending}><Download className="mr-1 h-4 w-4" /> Open / Download</Button>
                  <Button variant="destructive" className="w-full" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash className="mr-1 h-4 w-4" /> Delete</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
