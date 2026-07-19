'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, FileText, Plus, Power, XCircle } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/auth/AuthProvider';
import { activateContract, fetchContracts, terminateContract } from '@/lib/api';

const statusColor: Record<string, string> = {
  active: 'default',
  pending: 'secondary',
  terminated: 'destructive',
  superseded: 'outline',
};

export default function AdminHrContractsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();


  const { data, isLoading, error } = useQuery({
    queryKey: ['contracts', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchContracts(token);
    },
    enabled: !!token,
  });

  const contracts = useMemo(() => data?.data ?? [], [data?.data]);

  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((c: any) => c.status === 'active').length;
    const pending = contracts.filter((c: any) => c.status === 'pending').length;
    const terminated = contracts.filter((c: any) => c.status === 'terminated').length;
    return { total, active, pending, terminated };
  }, [contracts]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['contracts', token] });

  const activate = useMutation({
    mutationFn: (id: number) => {
      if (!token) throw new Error('No token');
      return activateContract(token, id);
    },
    onSuccess: refresh,
  });

  const terminate = useMutation({
    mutationFn: (id: number) => {
      if (!token) throw new Error('No token');
      return terminateContract(token, id, 'Terminated from UI');
    },
    onSuccess: refresh,
  });

  const statCards = [
    { label: 'Total Contracts', value: stats.total, icon: FileText },
    { label: 'Active', value: stats.active, icon: CheckCircle, accent: 'success' as const },
    { label: 'Pending', value: stats.pending, icon: Power, accent: 'warning' as const },
    { label: 'Terminated', value: stats.terminated, icon: XCircle, accent: 'destructive' as const },
  ];

  return (
    <PageShell title="Contracts" icon={FileText} description="Manage employee contracts, activations, and terminations." actions={<Button asChild><Link href="/admin/hr/contracts/new"><Plus className="mr-1 h-4 w-4" /> New Contract</Link></Button>}>
      <StatCards cards={statCards} />

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle>Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive">Failed to load contracts.</div>}
          {isLoading && <div className="text-muted-foreground">Loading...</div>}

          {!isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">No contracts found.</TableCell>
                  </TableRow>
                )}
                {contracts.map((c: any) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-primary/5"
                    onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; router.push(`/admin/hr/contracts/${c.id}`); }}
                  >
                    <TableCell>{c.employee?.name || `Employee ${c.employee_id}`}</TableCell>
                    <TableCell>{c.position || '-'}</TableCell>
                    <TableCell className="capitalize">{c.employment_type?.replace('_', ' ') || '-'}</TableCell>
                    <TableCell>{c.start_date ? new Date(c.start_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{c.end_date ? new Date(c.end_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{c.salary ? `${c.currency || 'AUD'} ${c.salary}` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={(statusColor[c.status || ''] as any) || 'secondary'}>{c.status || 'active'}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {c.status !== 'active' && (
                        <Button size="sm" variant="outline" onClick={() => activate.mutate(c.id)} disabled={activate.isPending}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {c.status !== 'terminated' && (
                        <Button size="sm" variant="outline" onClick={() => terminate.mutate(c.id)} disabled={terminate.isPending}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
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
