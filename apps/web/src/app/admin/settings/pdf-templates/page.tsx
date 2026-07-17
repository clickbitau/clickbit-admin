'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, FileText, Plus, Star, Trash2 } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/auth/AuthProvider';
import { clonePdfTemplate, createPdfTemplate, deletePdfTemplate, fetchPdfTemplates, setDefaultPdfTemplate, updatePdfTemplate } from '@/lib/api';

export default function AdminPdfTemplatesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<{ id?: number; name: string; type: string; description: string; html: string; css: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pdf-templates', token, filter],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchPdfTemplates(token, filter || undefined);
    },
    enabled: !!token,
  });

  const templates = data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pdf-templates', token] });

  const create = useMutation({
    mutationFn: () => createPdfTemplate(token!, { ...editing }),
    onSuccess: () => { refresh(); setEditing(null); },
  });

  const update = useMutation({
    mutationFn: () => updatePdfTemplate(token!, editing!.id!, { ...editing }),
    onSuccess: () => { refresh(); setEditing(null); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deletePdfTemplate(token!, id),
    onSuccess: refresh,
  });

  const setDefault = useMutation({
    mutationFn: (id: number) => setDefaultPdfTemplate(token!, id),
    onSuccess: refresh,
  });

  const clone = useMutation({
    mutationFn: (id: number) => clonePdfTemplate(token!, id),
    onSuccess: refresh,
  });

  const statCards = [
    { label: 'Total Templates', value: templates.length, icon: FileText },
    { label: 'Default', value: templates.filter((t: any) => t.is_default).length, icon: Star },
    { label: 'Invoice', value: templates.filter((t: any) => t.type === 'invoice').length, icon: FileText },
    { label: 'Payslip', value: templates.filter((t: any) => t.type === 'payslip').length, icon: FileText },
  ];

  return (
    <PageShell title="PDF Templates" icon={FileText} description="Design and manage invoice, payslip, and document templates.">
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Filter by type..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        <Button onClick={() => setEditing({ name: '', type: 'invoice', description: '', html: '', css: '' })}>
          <Plus className="mr-2 h-4 w-4" /> New Template
        </Button>
      </div>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>{editing.id ? 'Edit Template' : 'New Template'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input placeholder="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input placeholder="Type (invoice, payslip, contract)" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} />
              <Input placeholder="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <Textarea placeholder="HTML body" value={editing.html} onChange={(e) => setEditing({ ...editing, html: e.target.value })} rows={8} />
            <Textarea placeholder="CSS styles" value={editing.css} onChange={(e) => setEditing({ ...editing, css: e.target.value })} rows={4} />
            <div className="flex gap-2">
              <Button onClick={() => (editing.id ? update.mutate() : create.mutate())} disabled={create.isPending || update.isPending}>
                {editing.id ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive">Failed to load templates.</div>}
          {isLoading && <div className="text-muted-foreground">Loading...</div>}

          {!isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No templates found.</TableCell>
                  </TableRow>
                )}
                {templates.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="capitalize">{t.type}</TableCell>
                    <TableCell>{t.description || '-'}</TableCell>
                    <TableCell>{t.is_default && <Badge variant="default">Default</Badge>}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing({ id: t.id, name: t.name, type: t.type, description: t.description || '', html: t.html || '', css: t.css || '' })}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => clone.mutate(t.id)} disabled={clone.isPending}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDefault.mutate(t.id)} disabled={setDefault.isPending}>
                        <Star className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove.mutate(t.id)} disabled={remove.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
