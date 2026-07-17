'use client';
import Link from 'next/link';
import { Plus, FolderKanban as FolderKanbanIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAdminPortfolio, deletePortfolioItem } from '@/lib/api';
import type { PortfolioItem } from '@/types/content';

export default function AdminContentPortfolioPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-portfolio', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminPortfolio(token); }, enabled: !!token });

  const remove = useMutation({
    mutationFn: (id: number) => deletePortfolioItem(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-portfolio', token] }),
  });

  return (
    <PageShell
      title="Portfolio"
      icon={FolderKanbanIcon}
      actions={<Button asChild><Link href="/admin/content/portfolio/new"><Plus className="mr-1 h-4 w-4" /> New Item</Link></Button>}
    >
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