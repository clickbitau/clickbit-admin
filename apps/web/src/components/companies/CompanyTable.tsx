'use client';

import { useRouter } from 'next/navigation';
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
import { Building2, FolderKanban, Briefcase, ListTodo } from 'lucide-react';
import { Company } from '@clickbit/shared';
import Image from 'next/image';

interface CompanyTableProps {
  companies: Company[];
  loading: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  subscriber: 'Subscriber',
  lead: 'Lead',
  marketing_qualified: 'MQL',
  sales_qualified: 'SQL',
  opportunity: 'Opportunity',
  customer: 'Customer',
  evangelist: 'Evangelist',
  other: 'Other',
  completed: 'Completed',
  internal: 'Internal',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getStageColor(stage?: string | null) {
  switch (stage) {
    case 'customer':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'opportunity':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'sales_qualified':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'marketing_qualified':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'lead':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

export function CompanyTable({ companies, loading }: CompanyTableProps) {
  const router = useRouter();

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
            <TableHead className="w-[35%]">Company</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Counts</TableHead>
            <TableHead>Primary Contact</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <TableRow
              key={company.id}
              className="border-b border-border/30 hover:bg-primary/5 cursor-pointer"
              onClick={() => router.push(`/admin/crm/companies/${company.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  {company.logo_url ? (
                    <Image
                      src={company.logo_url}
                      alt={company.name}
                      width={36}
                      height={36}
                      unoptimized
                      className="h-9 w-9 rounded-lg object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate block">{company.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {[company.city, company.country].filter(Boolean).join(', ') || company.domain || '-'}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-gray-700 dark:text-gray-300">{company.industry || '-'}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={`${getStageColor(company.lifecycle_stage)} border-0`}>
                  {STAGE_LABELS[company.lifecycle_stage || ''] || company.lifecycle_stage || '-'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                {formatCurrency(Number(company.total_revenue ?? 0))}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-0.5" title="Deals">
                    <Briefcase className="h-3 w-3" /> {company.total_deals ?? 0}
                  </span>
                  <span className="flex items-center gap-0.5" title="Projects">
                    <FolderKanban className="h-3 w-3" /> {company.total_projects ?? 0}
                  </span>
                  <span className="flex items-center gap-0.5" title="Tasks">
                    <ListTodo className="h-3 w-3" /> {company.total_tasks ?? 0}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {company.primary_contact ? (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-gray-900 dark:text-white">{company.primary_contact.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{company.primary_contact.email}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
