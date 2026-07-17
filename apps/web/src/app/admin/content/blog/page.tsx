'use client';
import Link from 'next/link';
import { Plus, BookOpen as BookOpenIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAdminBlogPosts, deleteBlogPost } from '@/lib/api';
import type { BlogPost } from '@/types/content';

export default function AdminContentBlogPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-blog', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminBlogPosts(token); }, enabled: !!token });

  const remove = useMutation({
    mutationFn: (id: number) => deleteBlogPost(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-blog', token] }),
  });

  return (
    <PageShell
      title="Blog"
      icon={BookOpenIcon}
      actions={<Button asChild><Link href="/admin/content/blog/new"><Plus className="mr-1 h-4 w-4" /> New Post</Link></Button>}
    >
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="divide-y">
          {data?.posts?.map((p: BlogPost) => (
            <div key={p.id} className="flex items-center justify-between py-2">
              <div>
                <Link href={`/admin/content/blog/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                <div className="text-sm text-muted-foreground">{p.status}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => remove.mutate(p.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}