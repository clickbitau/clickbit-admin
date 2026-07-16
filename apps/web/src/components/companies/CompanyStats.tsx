'use client';

import { Building2, Briefcase, TrendingUp, Users } from 'lucide-react';
import { AggregatedStats } from '@clickbit/shared';
import { StatCards } from '@/components/design-system/StatCards';

interface CompanyStatsProps {
  totalCompanies: number;
  aggregatedStats: AggregatedStats | undefined;
}

export function CompanyStats({ totalCompanies, aggregatedStats }: CompanyStatsProps) {
  const cards = [
    { label: 'Total Companies', value: totalCompanies, icon: Building2, accent: 'primary' as const },
    { label: 'Pipeline Value', value: formatCurrency(aggregatedStats?.totalValue ?? 0), icon: TrendingUp, accent: 'success' as const },
    { label: 'Open / Won Deals', value: aggregatedStats?.totalDeals ?? 0, icon: Briefcase, accent: 'secondary' as const },
    { label: 'Customers', value: aggregatedStats?.customerCount ?? 0, icon: Users, accent: 'warning' as const },
  ];

  return <StatCards cards={cards} />;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}
