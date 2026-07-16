'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/design-system/EmptyState';
import { Company } from '@clickbit/shared';

interface CompanyTableProps {
  companies: Company[];
  loading: boolean;
}

export function CompanyTable({ companies, loading }: CompanyTableProps) {
  if (loading) {
    return (
      <div className="nm-raised p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (companies.length === 0) {
    return <EmptyState text="No companies found." />;
  }

  return (
    <div className="nm-raised overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/50 hover:bg-transparent">
            <TableHead>Company</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Deals / Projects / Tasks</TableHead>
            <TableHead>Primary Contact</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <TableRow key={company.id} className="border-b border-border/30 hover:bg-primary/5">
              <TableCell className="font-medium">
                <div className="flex flex-col">
                  <span>{company.name}</span>
                  {company.city && (
                    <span className="text-xs text-muted-foreground">
                      {company.city}
                      {company.country ? `, ${company.country}` : ''}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>{company.industry || '-'}</TableCell>
              <TableCell>
                <Badge variant="secondary">{company.lifecycle_stage}</Badge>
              </TableCell>
              <TableCell>
                {new Intl.NumberFormat('en-AU', {
                  style: 'currency',
                  currency: 'AUD',
                  maximumFractionDigits: 0,
                }).format(Number(company.total_revenue ?? 0))}
              </TableCell>
              <TableCell>
                {company.total_deals ?? 0} / {company.total_projects ?? 0} /{' '}
                {company.total_tasks ?? 0}
              </TableCell>
              <TableCell>
                {company.primary_contact ? (
                  <div className="flex flex-col">
                    <span>{company.primary_contact.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {company.primary_contact.email}
                    </span>
                  </div>
                ) : (
                  '-'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
