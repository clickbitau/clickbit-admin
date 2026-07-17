'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, FileText, Plus, Power, Trash2, XCircle } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/auth/AuthProvider';
import { activateContract, createContract, fetchContracts, terminateContract, updateContract } from '@/lib/api';

const statusColor: Record<string, string> = {
  active: 'default',
  pending: 'secondary',
  terminated: 'destructive',
  superseded: 'outline',
};

export default function AdminHrContractsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [employmentType, setEmploymentType] = useState('full_time');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [payFrequency, setPayFrequency] = useState('fortnightly');

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

  const create = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('No token');
      return createContract(token, {
        employee_id: employeeId,
        start_date: startDate,
        employment_type: employmentType,
        position,
        salary,
        pay_frequency: payFrequency,
      });
    },
    onSuccess: () => {
      refresh();
      setEmployeeId('');
      setStartDate('');
      setPosition('');
      setSalary('');
    },
  });

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

  const update = useMutation({
    mutationFn: ({ id, field, value }: { id: number; field: string; value: any }) => {
      if (!token) throw new Error('No token');
      return updateContract(token, id, { [field]: value });
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
    <PageShell title="Contracts" icon={FileText} description="Manage employee contracts, activations, and terminations.">
      <StatCards cards={statCards} />

      <Card>
        <CardHeader>
          <CardTitle>New Contract</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <Input placeholder="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
          <Input placeholder="Salary" value={salary} onChange={(e) => setSalary(e.target.value)} />
          <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="casual">Casual</option>
            <option value="contractor">Contractor</option>
            <option value="intern">Intern</option>
          </select>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Create
          </Button>
        </CardContent>
      </Card>

      <Card>
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
                  <TableRow key={c.id}>
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
