'use client';
import { Users as UsersIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmployeeTable } from '@/components/hr/EmployeeTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchEmployees } from '@/lib/api';

export default function AdminHrEmployeesPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['employees', token, page, search],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12 };
      if (search) params.search = search;
      return fetchEmployees(token, params);
    },
    enabled: !!token,
  });

  const employees = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };

  const statCards = [
    { label: 'Total Employees', value: pagination.total ?? employees.length, icon: UsersIcon },
    { label: 'Active', value: employees.filter((e: any) => e.status === 'active').length, icon: UsersIcon, accent: 'success' as const },
    { label: 'On Leave', value: employees.filter((e: any) => e.status === 'on_leave').length, icon: UsersIcon, accent: 'warning' as const },
    { label: 'Terminated', value: employees.filter((e: any) => e.status === 'terminated').length, icon: UsersIcon, accent: 'destructive' as const },
  ];

  return (
    <PageShell
      title="Employees"
      icon={UsersIcon}
      description="Manage employee records and profiles."
    >
      <StatCards cards={statCards} />

      <Input
        placeholder="Search employees..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-sm"
      />

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-destructive">Failed to load employees.</div> : <EmployeeTable employees={employees} loading={isLoading} />}
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