'use client';
import Link from 'next/link';
import { FolderKanban as FolderKanbanIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAdminPortfolio, createPortfolioItem, deletePortfolioItem } from '@/lib/api';
import type { PortfolioItem } from '@/types/content';

export default function AdminContentPortfolioPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', client_name: '', category: '' });
  const { data, isLoading } = useQuery({ queryKey: ['admin-portfolio', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminPortfolio(token); }, enabled: !!token });

  const add = useMutation({
    mutationFn: () => createPortfolioItem(token!, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-portfolio', token] }); setForm({ title: '', client_name: '', category: '' }); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deletePortfolioItem(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-portfolio', token] }),
  });

  return (
    <PageShell
      title="Portfolio"
      icon={FolderKanbanIcon}
    >
      <Card>
        <CardHeader><CardTitle>New Portfolio Item</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="max-w-xs" />
          <Input placeholder="Client" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="max-w-xs" />
          <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="max-w-xs" />
          <Button onClick={() => form.title && add.mutate()} disabled={add.isPending}>Add</Button>
        </CardContent>
      </Card>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="divide-y">
          {data?.items?.map((p: PortfolioItem) => (
            <div key={p.id} className="flex items-center justify-between py-2">
              <div>
                <Link href={`/admin/content/portfolio/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                <div className="text-sm text-muted-foreground">{p.client_name || 'No client'} &middot; {p.status}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => remove.mutate(p.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}