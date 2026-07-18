'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Search, Trash2, Upload } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/auth/AuthProvider';
import { deleteDocument, fetchDocumentSignedUrl, fetchDocuments } from '@/lib/api';

function formatBytes(bytes?: number | null) {
  if (!bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export default function AdminDocumentsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(() => ({ page, limit: 20, search: search || undefined }), [page, search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['documents', token, params],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchDocuments(token, params);
    },
    enabled: !!token,
  });

  const documents = useMemo(() => data?.documents ?? [], [data?.documents]);
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 20 };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['documents', token] });

  const signedUrlMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!token) throw new Error('No token');
      const res = await fetchDocumentSignedUrl(token, id);
      return res.url;
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => {
      if (!token) throw new Error('No token');
      return deleteDocument(token, id);
    },
    onSuccess: refresh,
  });

  const statCards = [
    { label: 'Total Documents', value: pagination.totalItems, icon: FileText },
    { label: 'Active', value: documents.filter((d: any) => d.status === 'active').length, icon: FileText },
    { label: 'Pages', value: pagination.totalPages, icon: FileText },
    { label: 'Size', value: formatBytes(documents.reduce((sum, d) => sum + (d.file_size || 0), 0)), icon: Upload },
  ];

  return (
    <PageShell title="Documents" icon={FileText} description="Manage uploaded documents and generate signed URLs.">
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-2">
        <div className="relative sm:max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8"
          />
        </div>
        <Button asChild>
          <Link href="/admin/documents/new"><Upload className="mr-2 h-4 w-4" /> Upload Document</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive">Failed to load documents.</div>}
          {isLoading && <div className="text-muted-foreground">Loading...</div>}

          {!isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No documents found.</TableCell>
                  </TableRow>
                )}
                {documents.map((doc: any) => (
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer hover:bg-primary/5"
                    onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; router.push(`/admin/documents/${doc.id}`); }}
                  >
                    <TableCell className="font-medium truncate max-w-xs">{doc.name || doc.original_name || `Document ${doc.id}`}</TableCell>
                    <TableCell className="uppercase text-xs">{doc.file_type || '-'}</TableCell>
                    <TableCell>{formatBytes(doc.file_size)}</TableCell>
                    <TableCell>
                      <Badge variant={doc.status === 'active' ? 'default' : 'secondary'}>{doc.status || 'active'}</Badge>
                    </TableCell>
                    <TableCell>{doc.uploader?.name || doc.uploader?.email || '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => signedUrlMutation.mutate(doc.id)} disabled={signedUrlMutation.isPending}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {signedUrlMutation.data && signedUrlMutation.variables === doc.id && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={signedUrlMutation.data} target="_blank" rel="noreferrer">Open</a>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(doc.id)} disabled={removeMutation.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total)</p>
            <div className="space-x-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
