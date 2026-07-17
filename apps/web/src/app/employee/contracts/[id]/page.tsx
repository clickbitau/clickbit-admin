'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchEmployeeContract } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { FileText, ArrowLeft } from 'lucide-react';

export default function EmployeeContractDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = String(params.id);

  const { data, isLoading } = useQuery({
    queryKey: ['employee-contract', id, token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeeContract(token, id);
    },
    enabled: !!token && !!id,
  });

  const contract = data?.data;

  if (isLoading) {
    return (
      <PageShell title="Contract" icon={FileText}>
        <Skeleton className="h-40 rounded-2xl" />
      </PageShell>
    );
  }

  if (!contract) {
    return (
      <PageShell title="Contract" icon={FileText}>
        <p className="text-sm text-muted-foreground">Contract not found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`Contract ${contract.contract_number ? `#${contract.contract_number}` : `#${contract.id}`}`}
      icon={FileText}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/employee/contracts"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span> <span className="capitalize">{contract.employment_type?.replace(/_/g, ' ') || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Position</span> <span>{contract.position || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Department</span> <span>{contract.department || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span> <span className="capitalize">{contract.status || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Manager</span> <span>{contract.manager?.name || '-'}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Dates & Pay</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span> <span>{formatDate(contract.start_date)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">End Date</span> <span>{formatDate(contract.end_date)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Renewal Date</span> <span>{formatDate(contract.renewal_date)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Salary</span> <span>{contract.salary ? formatCurrency(Number(contract.salary), contract.currency || undefined) : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Hourly Rate</span> <span>{contract.hourly_rate ? `${formatCurrency(Number(contract.hourly_rate), contract.currency || undefined)}/hr` : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Weekly Hours</span> <span>{contract.default_weekly_hours ?? '-'}</span></div>
          </CardContent>
        </Card>
        {contract.terms_summary && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Terms Summary</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-line">{contract.terms_summary}</p></CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
