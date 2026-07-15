'use client';

import { AggregatedStats } from '@clickbit/shared';

interface CompanyStatsProps {
  totalCompanies: number;
  aggregatedStats: AggregatedStats | undefined;
}

export function CompanyStats({ totalCompanies, aggregatedStats }: CompanyStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total Companies" value={totalCompanies} />
      <StatCard
        label="Pipeline Value"
        value={formatCurrency(aggregatedStats?.totalValue ?? 0)}
      />
      <StatCard label="Open / Won Deals" value={aggregatedStats?.totalDeals ?? 0} />
      <StatCard label="Customers" value={aggregatedStats?.customerCount ?? 0} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}
