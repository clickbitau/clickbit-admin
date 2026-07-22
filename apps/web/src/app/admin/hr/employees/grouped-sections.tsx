import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { formatDate } from '@/lib/format';
import type { Employee } from '@/types/hr';

const typeColors: Record<string, string> = {
  full_time: 'bg-blue-500',
  part_time: 'bg-indigo-500',
  casual: 'bg-amber-500',
  contractor: 'bg-emerald-500',
  intern: 'bg-purple-500',
};

const departmentColors = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-rose-500',
];

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

function leaveBalance(value?: number | null) {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  const formatted = Number.isInteger(num) ? num.toString() : num.toFixed(1);
  return `${formatted} hrs`;
}

interface GroupedEmployeeSectionsProps {
  employees: Employee[];
  mode: 'employment_type' | 'department';
  typeOptions: { value: string; label: string }[];
  isLoading?: boolean;
  onRowClick?: (employee: Employee) => void;
}

export function GroupedEmployeeSections({ employees, mode, typeOptions, isLoading, onRowClick }: GroupedEmployeeSectionsProps) {
  if (isLoading && employees.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading employees…</div>;
  }

  const groups = mode === 'employment_type'
    ? typeOptions
        .filter((o) => o.value)
        .map((o) => ({
          key: o.value,
          label: o.label,
          color: typeColors[o.value] || 'bg-slate-500',
          employees: employees.filter((e) => e.employment_type === o.value || (!e.employment_type && o.value === 'full_time')),
        }))
    : Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort().map((dept, i) => ({
        key: dept as string,
        label: dept as string,
        color: departmentColors[i % departmentColors.length],
        employees: employees.filter((e) => e.department === dept),
      }));

  const visibleGroups = groups.filter((g) => g.employees.length > 0);

  if (visibleGroups.length === 0) {
    return (
      <div className="nm-raised p-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">No employees found</p>
        <p className="text-sm mt-1">Try adjusting filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {visibleGroups.map((group) => (
        <div key={group.key} className="nm-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${group.color}`} />
            <h3 className="font-semibold">{group.label}</h3>
            <Badge variant="secondary">{group.employees.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">ID</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Department</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Position</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Manager</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Leave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {group.employees.map((employee) => (
                  <tr
                    key={employee.id}
                    onClick={() => onRowClick?.(employee)}
                    className="hover:brightness-[0.97] dark:hover:brightness-110 cursor-pointer transition-all"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={employeeName(employee)} avatar_url={employee.user?.avatar} />
                        <div>
                          <Link href={`/admin/hr/employees/${employee.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                            {employeeName(employee)}
                          </Link>
                          <p className="text-xs text-muted-foreground">{employee.user?.email || employee.user?.phone || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">{employee.employee_number || `#${employee.id}`}</td>
                    <td className="px-4 py-3">{employee.department || '-'}</td>
                    <td className="px-4 py-3">{employee.position || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {employee.manager ? <PersonAvatar name={managerName(employee)} size="sm" /> : null}
                        <span>{managerName(employee)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={employee.employment_status || 'active'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs space-y-0.5">
                        <p className={Number(employee.annual_leave_balance || 0) < 0 ? 'text-destructive' : ''}>A: {leaveBalance(employee.annual_leave_balance)}</p>
                        <p className={Number(employee.sick_leave_balance || 0) < 0 ? 'text-destructive' : 'text-muted-foreground'}>S: {leaveBalance(employee.sick_leave_balance)}</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
