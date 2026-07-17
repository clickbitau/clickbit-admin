'use client';
import { Users as UsersIcon, Plus } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmployeeTable } from '@/components/hr/EmployeeTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchEmployees, fetchHrStats, fetchDepartments } from '@/lib/api';
import Link from 'next/link';

const statusOptions = ['', 'active', 'inactive', 'on_leave', 'terminated'];
const typeOptions = ['', 'full_time', 'part_time', 'contract', 'casual', 'intern'];
const sortOptions = [
  { key: 'hire_date', label: 'Hire date' },
  { key: 'created_at', label: 'Created' },
  { key: 'last_name', label: 'Last name' },
];

export default function AdminHrEmployeesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [sortBy, setSortBy] = useState('hire_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['employees', token, page, search, status, department, employmentType, sortBy, sortOrder],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12, sortBy, sortOrder };
      if (search) params.search = search;
      if (status) params.employment_status = status;
      if (department) params.department = department;
      if (employmentType) params.employment_type = employmentType;
      return fetchEmployees(token, params);
    },
    enabled: !!token,
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchDepartments(token); },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
    enabled: !!token,
  });

  const employees = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total', value: stats.employees.total, icon: UsersIcon },
      { label: 'Active', value: stats.employees.active, icon: UsersIcon, accent: 'success' as const, onClick: () => { setStatus('active'); setPage(1); } },
      { label: 'On Leave', value: stats.employees.onLeave, icon: UsersIcon, accent: 'warning' as const, onClick: () => { setStatus('on_leave'); setPage(1); } },
      { label: 'Terminated', value: stats.employees.terminated, icon: UsersIcon, accent: 'destructive' as const, onClick: () => { setStatus('terminated'); setPage(1); } },
    ];
  }, [stats]);

  return (
    <PageShell
      title="Employees"
      icon={UsersIcon}
      description="Manage employee records and profiles."
      actions={<Button asChild><Link href="/admin/hr/employees/new"><Plus className="mr-2 h-4 w-4" /> New Employee</Link></Button>}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search employees..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All statuses'}</option>
          ))}
        </select>
        <select
          value={department}
          onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All departments</option>
          {(departmentsData?.data ?? []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select
          value={employmentType}
          onChange={(e) => { setEmploymentType(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {typeOptions.map((t) => <option key={t} value={t}>{t ? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All types'}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {sortOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
        >
          {sortOrder === 'asc' ? 'Asc' : 'Desc'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-destructive">Failed to load employees.</div> : <EmployeeTable employees={employees} loading={isLoading} onRowClick={(e) => router.push(`/admin/hr/employees/${e.id}`)} />}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {pagination.page} of {pagination.pages} ({pagination.total} total)
        </p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
