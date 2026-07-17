'use client';
import Link from 'next/link';
import { Plus, User as UserIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchUsers, deleteUser } from '@/lib/api';
import type { User } from '@/types/crm';

export default function AdminSettingsUsersPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-users', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchUsers(token); }, enabled: !!token });

  const remove = useMutation({
    mutationFn: (id: number) => deleteUser(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users', token] }),
  });

  const users = useMemo(() => data?.data ?? [], [data?.data]);
  const statCards = [
    { label: 'Total Users', value: users.length, icon: UserIcon },
    { label: 'Admins', value: users.filter((u: User) => u.role === 'admin').length, icon: UserIcon, accent: 'primary' as const },
    { label: 'Managers', value: users.filter((u: User) => u.role === 'manager').length, icon: UserIcon, accent: 'warning' as const },
    { label: 'Customers', value: users.filter((u: User) => u.role === 'customer').length, icon: UserIcon, accent: 'success' as const },
  ];

  return (
    <PageShell
      title="Users"
      icon={UserIcon}
      actions={<Button asChild><Link href="/admin/settings/users/new"><Plus className="mr-1 h-4 w-4" /> New User</Link></Button>}
    >
      <StatCards cards={statCards} />

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="divide-y">
          {data?.data?.map((u: User) => (
            <div key={u.id} className="flex items-center justify-between py-2">
              <div>
                <Link href={`/admin/settings/users/${u.id}`} className="font-medium hover:underline">{u.first_name} {u.last_name}</Link>
                <div className="text-sm text-muted-foreground">{u.email} &middot; {u.role} &middot; {u.status}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => remove.mutate(u.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}