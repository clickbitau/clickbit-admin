'use client';
import Link from 'next/link';
import { Plus, Users as UsersIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAdminTeamMembers, deleteTeamMember } from '@/lib/api';
import type { TeamMember } from '@/types/content';

export default function AdminContentTeamPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-team', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminTeamMembers(token); }, enabled: !!token });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTeamMember(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-team', token] }),
  });

  return (
    <PageShell
      title="Team"
      icon={UsersIcon}
      actions={<Button asChild><Link href="/admin/content/team/new"><Plus className="mr-1 h-4 w-4" /> New Member</Link></Button>}
    >
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="divide-y">
          {data?.map((m: TeamMember) => (
            <div key={m.id} className="flex items-center justify-between py-2">
              <div>
                <Link href={`/admin/content/team/${m.id}`} className="font-medium hover:underline">{m.name}</Link>
                <div className="text-sm text-muted-foreground">{m.role}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => remove.mutate(m.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}