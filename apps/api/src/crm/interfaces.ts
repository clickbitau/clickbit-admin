import { Pagination } from '@clickbit/shared';

export interface ListResponse<T> {
  items: T[];
  pagination: Pagination;
}

export type WithLegacyKey<T, K extends string> = {
  [P in K]: T[];
} & { pagination: Pagination };

export interface LegacyListResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface IdParam { id: string; }
export interface CompanyIdParam { companyId: string; }
export interface ContactCompanyIds {
  contactId: string;
  companyId: string;
}

export interface PipelineStagesResponse {
  pipeline: unknown;
  stages: unknown[];
  stats?: unknown;
}

export interface PortalAccessResponse {
  hasAccess: boolean;
  user?: unknown;
  linkType?: string | null;
}

export interface ProjectBreakdownResponse {
  company_id: number;
  company_name: string;
  total: number;
  currency: string;
  breakdown: unknown[];
  counts: { invoices: number; deals: number; projects: number };
}
