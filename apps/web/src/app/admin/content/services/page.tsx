'use client';
import Link from 'next/link';
import { Plus, Briefcase as BriefcaseIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchAdminServices, deleteService } from '@/lib/api';
import type { Service } from '@/types/content';

export default function AdminContentServicesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-services', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminServices(token); }, enabled: !!token });

  const remove = useMutation({
    mutationFn: (id: number) => deleteService(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-services', token] }),
  });

  const items = data?.items ?? [];
  const statCards = [
    { label: 'Total Services', value: items.length, icon: BriefcaseIcon },
    { label: 'Active', value: items.filter((s: Service) => s.status === 'published').length, icon: BriefcaseIcon, accent: 'success' as const },
    { label: 'Draft', value: items.filter((s: Service) => s.status === 'draft').length, icon: BriefcaseIcon, accent: 'warning' as const },
    { label: 'Archived', value: items.filter((s: Service) => s.status === 'archived').length, icon: BriefcaseIcon, accent: 'destructive' as const },
  ];

  return (
    <PageShell
      title="Services"
      icon={BriefcaseIcon}
      actions={<Button asChild><Link href="/admin/content/services/new"><Plus className="mr-1 h-4 w-4" /> New Service</Link></Button>}
    >
      <StatCards cards={statCards} />

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="divide-y">
          {data?.items?.map((s: Service) => (
            <div key={s.id} className="flex items-center justify-between py-2">
              <div>
                <Link href={`/admin/content/services/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                <div className="text-sm text-muted-foreground">{s.category} &middot; {s.status}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => remove.mutate(s.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}