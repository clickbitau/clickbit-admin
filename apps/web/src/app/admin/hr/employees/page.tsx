'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { EmployeeForm } from '@/components/hr/EmployeeForm';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchEmployees, fetchHrStats, fetchDepartments } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Employee } from '@/types/hr';
import { Users as UsersIcon, Plus, RefreshCw, Search, Building2, UserCircle, List } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
];

const typeOptions = [
  { value: '', label: 'All types' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'casual', label: 'Casual' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'intern', label: 'Intern' },
];

const sortOptions = [
  { value: 'hire_date', label: 'Hire date' },
  { value: 'created_at', label: 'Created' },
  { value: 'last_name', label: 'Last name' },
  { value: 'employment_status', label: 'Status' },
  { value: 'employment_type', label: 'Type' },
];

export default function AdminHrEmployeesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [sortBy, setSortBy] = useState('hire_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'department' | 'employment_type'>('list');

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 12, sortBy, sortOrder };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.employment_status = status;
    if (department) params.department = department;
    if (employmentType) params.employment_type = employmentType;
    return params;
  }, [page, debouncedSearch, status, department, employmentType, sortBy, sortOrder]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['employees', queryParams],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployees(token, queryParams);
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

  useRealtimeRefresh(['employees'], ['employees'], { enabled: !!token });

  const employees = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;
  const departments = departmentsData?.data ?? [];

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total', value: stats.employees.total, icon: UsersIcon },
      { label: 'Active', value: stats.employees.active, icon: UsersIcon, accent: 'success' as const, onClick: () => { setStatus('active'); setPage(1); } },
      { label: 'On Leave', value: stats.employees.onLeave, icon: UsersIcon, accent: 'warning' as const, onClick: () => { setStatus('on_leave'); setPage(1); } },
      { label: 'Terminated', value: stats.employees.terminated, icon: UsersIcon, accent: 'destructive' as const, onClick: () => { setStatus('terminated'); setPage(1); } },
    ];
  }, [stats]);

  function employeeName(employee: Employee) {
    if (employee.user) {
      const full = `${employee.user.first_name || ''} ${employee.user.last_name || ''}`.trim();
      return full || employee.user.email || `Employee #${employee.id}`;
    }
    return employee.name || `Employee #${employee.id}`;
  }

  function managerName(employee: Employee) {
    if (employee.manager) {
      const full = `${employee.manager.first_name || ''} ${employee.manager.last_name || ''}`.trim();
      return full || employee.manager.email || '-';
    }
    return '-';
  }

  return (
    <PageShell
      title="Employees"
      icon={UsersIcon}
      description="Manage employee records, departments, and profiles."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh" aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Employee
          </Button>
        </div>
      }
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}><List className="mr-1 h-4 w-4" /> List</Button>
        <Button variant={viewMode === 'department' ? 'default' : 'outline'} size="sm" onClick={() => { setDepartment(''); setViewMode('department'); }}><Building2 className="mr-1 h-4 w-4" /> By Department</Button>
        <Button variant={viewMode === 'employment_type' ? 'default' : 'outline'} size="sm" onClick={() => { setEmploymentType(''); setViewMode('employment_type'); }}><UserCircle className="mr-1 h-4 w-4" /> By Type</Button>
      </div>

      {viewMode === 'department' && (
        <EmployeeGroupCards
          groups={stats?.employees.byDepartment || []}
          labelKey="department"
          onSelect={(value) => { setDepartment(value); setViewMode('list'); setPage(1); }}
          loading={statsLoading}
          icon={Building2}
        />
      )}

      {viewMode === 'employment_type' && (
        <EmployeeGroupCards
          groups={stats?.employees.byType.map((t) => ({ ...t, label: typeOptions.find((o) => o.value === t.type)?.label || t.type })) || []}
          labelKey="label"
          valueKey="type"
          onSelect={(value) => { setEmploymentType(value); setViewMode('list'); setPage(1); }}
          loading={statsLoading}
          icon={UserCircle}
        />
      )}

      {viewMode === 'list' && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={department} onValueChange={(v) => { setDepartment(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All departments</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={employmentType} onValueChange={(v) => { setEmploymentType(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Employment type" /></SelectTrigger>
              <SelectContent>
                {typeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                {sortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
          </div>

          {error ? (
            <div className="text-destructive text-sm">Failed to load employees.</div>
          ) : (
            <DataTable
              headers={[
                { key: 'employee', label: 'Employee' },
                { key: 'number', label: 'Number' },
                { key: 'department', label: 'Department' },
                { key: 'position', label: 'Position' },
                { key: 'manager', label: 'Manager' },
                { key: 'type', label: 'Type' },
                { key: 'status', label: 'Status' },
                { key: 'hire_date', label: 'Hire date' },
              ]}
              data={employees}
              keyExtractor={(e) => e.id}
              loading={isLoading}
              onRowClick={(e) => router.push(`/admin/hr/employees/${e.id}`)}
              emptyText="No employees found."
              emptyDescription="Try adjusting your search or filters."
              renderRow={(employee) => [
                <div key="employee" className="flex items-center gap-3">
                  <PersonAvatar name={employeeName(employee)} avatar_url={employee.user?.avatar} />
                  <div>
                    <Link href={`/admin/hr/employees/${employee.id}`} className="font-medium hover:underline">{employeeName(employee)}</Link>
                    <p className="text-xs text-muted-foreground">{employee.user?.email || employee.user?.phone || '-'}</p>
                  </div>
                </div>,
                <span key="number" className="font-mono text-sm">{employee.employee_number || `#${employee.id}`}</span>,
                <Badge key="department" variant="outline" className="capitalize">{employee.departmentInfo?.name || employee.department || '-'}</Badge>,
                <span key="position">{employee.position || '-'}</span>,
                <div key="manager" className="flex items-center gap-2">
                  {employee.manager ? (
                    <>
                      <PersonAvatar name={managerName(employee)} size="sm" />
                      <span>{managerName(employee)}</span>
                    </>
                  ) : (
                    <span>-</span>
                  )}
                </div>,
                <span key="type" className="capitalize">{(employee.employment_type || '').replace(/_/g, ' ')}</span>,
                <StatusBadge key="status" status={employee.employment_status || 'active'} />,
                <span key="hire_date">{formatDate(employee.hire_date)}</span>,
              ]}
            />
          )}

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            onPageChange={setPage}
          />
        </>
      )}

      {token && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Employee</DialogTitle>
              <DialogDescription>Create an employee record linked to a user.</DialogDescription>
            </DialogHeader>
            <EmployeeForm
              token={token}
              onSuccess={() => { setCreateOpen(false); refetch(); }}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  );
}

function EmployeeGroupCards({
  groups,
  labelKey,
  valueKey = labelKey,
  onSelect,
  loading,
  icon: Icon,
}: {
  groups: Array<{ count: number; [key: string]: string | number }>;
  labelKey: string;
  valueKey?: string;
  onSelect: (value: string) => void;
  loading?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">Loading groups...</div>;
  }
  if (groups.length === 0) {
    return <div className="text-sm text-muted-foreground py-4">No groups found.</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => {
        const label = String(g[labelKey] || 'Unspecified');
        const value = String(g[valueKey] || label);
        return (
          <Card key={value} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => onSelect(value)}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate capitalize">{label.replace(/_/g, ' ')}</div>
                <div className="text-sm text-muted-foreground">{g.count} employees</div>
              </div>
              <Button variant="ghost" size="sm">View</Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
