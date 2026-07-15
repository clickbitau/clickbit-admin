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
import { Company } from '@clickbit/shared';

interface CompanyTableProps {
  companies: Company[];
  loading: boolean;
}

export function CompanyTable({ companies, loading }: CompanyTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No companies found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
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
            <TableRow key={company.id}>
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
