import { Response } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { Pagination } from '@clickbit/shared';
import {
  enum_crm_companies_company_size,
  enum_crm_projects_support_period_type,
  enum_crm_subprojects_support_period_type,
} from '@prisma/client';

export function setNoCache(res: Response): void {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
}

export function buildPagination(totalItems: number, page: number, limit: number): Pagination {
  return {
    currentPage: page,
    totalPages: totalItems > 0 ? Math.ceil(totalItems / limit) : 1,
    totalItems,
    itemsPerPage: limit,
  };
}

export function buildLegacyList<T>(key: string, items: T[], total: number, page: number, limit: number) {
  return {
    [key]: items,
    pagination: buildPagination(total, page, limit),
  };
}

export function toNumber(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (value instanceof Decimal) return Number(value);
  if (typeof value === 'object' && value !== null && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber() || 0;
  }
  return 0;
}

export function safeDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export function asJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export function normalizeCompanySize(value?: string): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase().replace(/\s/g, '').replace(/employees?/g, '');
  if (normalized.includes('1-10') || normalized.includes('1to10') || normalized.includes('1–10')) return '1-10';
  if (normalized.includes('11-50') || normalized.includes('11to50') || normalized.includes('11–50')) return '11-50';
  if (normalized.includes('51-200') || normalized.includes('51to200') || normalized.includes('51–200')) return '51-200';
  if (normalized.includes('201-500') || normalized.includes('201to500') || normalized.includes('201–500')) return '201-500';
  if (normalized.includes('501-1000') || normalized.includes('501to1000') || normalized.includes('501–1000')) return '501-1000';
  if (normalized.includes('1000+') || normalized.includes('1000plus') || normalized.includes('>1000')) return '1000+';
  return undefined;
}

export function mapCompanySize(
  value?: string,
): enum_crm_companies_company_size | undefined {
  const canonical = normalizeCompanySize(value);
  if (!canonical) return undefined;
  const map: Record<string, enum_crm_companies_company_size> = {
    '1-10': enum_crm_companies_company_size.size_1_10,
    '11-50': enum_crm_companies_company_size.size_11_50,
    '51-200': enum_crm_companies_company_size.size_51_200,
    '201-500': enum_crm_companies_company_size.size_201_500,
    '501-1000': enum_crm_companies_company_size.size_501_1000,
    '1000+': enum_crm_companies_company_size.size_1000_plus,
  };
  return map[canonical];
}

export function mapProjectSupportPeriod(
  value?: string,
): enum_crm_projects_support_period_type | undefined {
  const map: Record<string, enum_crm_projects_support_period_type> = {
    '3_months': enum_crm_projects_support_period_type.three_months,
    '6_months': enum_crm_projects_support_period_type.six_months,
    '1_year': enum_crm_projects_support_period_type.one_year,
    '2_years': enum_crm_projects_support_period_type.two_years,
    '3_years': enum_crm_projects_support_period_type.three_years,
    '5_years': enum_crm_projects_support_period_type.five_years,
    lifetime: enum_crm_projects_support_period_type.lifetime,
    custom: enum_crm_projects_support_period_type.custom,
  };
  return value ? map[value] : undefined;
}

export function mapSubprojectSupportPeriod(
  value?: string,
): enum_crm_subprojects_support_period_type | undefined {
  const map: Record<string, enum_crm_subprojects_support_period_type> = {
    '3_months': enum_crm_subprojects_support_period_type.three_months,
    '6_months': enum_crm_subprojects_support_period_type.six_months,
    '1_year': enum_crm_subprojects_support_period_type.one_year,
    '2_years': enum_crm_subprojects_support_period_type.two_years,
    '3_years': enum_crm_subprojects_support_period_type.three_years,
    '5_years': enum_crm_subprojects_support_period_type.five_years,
    lifetime: enum_crm_subprojects_support_period_type.lifetime,
    custom: enum_crm_subprojects_support_period_type.custom,
  };
  return value ? map[value] : undefined;
}
