import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export * from './crm';
export * from './finance';
export * from './hr';
export * from './support';
export * from './communication';
export * from './content';
export * from './settings';
export * from './bug-reports';

export type UserRole = 'admin' | 'manager' | 'employee' | 'customer' | 'agent';

export interface Profile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  auth_uid?: string | null;
  avatar?: string | null;
  permissions?: string[] | string | null;
  is_demo?: boolean;
  status?: string;
  created_at?: Date | string;
  updated_at?: Date | string;
  deleted_at?: Date | string | null;
}

export interface Contact {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
}

export interface CompanyOwner {
  id: number;
  first_name: string;
  last_name: string;
}

export interface Company {
  id: number;
  name: string;
  contact_person?: string | null;
  domain?: string | null;
  industry?: string | null;
  company_size?: string | null;
  annual_revenue?: number | string | null;
  phone?: string | null;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  description?: string | null;
  logo_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  facebook_url?: string | null;
  owner_id?: number | null;
  parent_company_id?: number | null;
  agent_id?: number | null;
  lifecycle_stage?: string;
  lead_source?: string | null;
  last_activity_at?: Date | string | null;
  total_revenue?: number | string | null;
  total_deals?: number | null;
  custom_fields?: Record<string, unknown> | null;
  tags?: string[] | null;
  is_active?: boolean;
  is_demo?: boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
  deleted_at?: Date | string | null;
  // Computed fields returned by the API
  owner?: CompanyOwner | null;
  primary_contact?: Contact | null;
  effective_email?: string | null;
  effective_phone?: string | null;
  total_projects?: number;
  total_tasks?: number;
  total_tickets?: number;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface AggregatedStats {
  totalValue: number;
  totalDeals: number;
  customerCount: number;
}

export interface CompaniesListResponse {
  companies: Company[];
  pagination: Pagination;
  aggregatedStats?: AggregatedStats;
}

export const ALLOWED_COMPANY_SORT = [
  'name',
  'updated_at',
  'created_at',
  'city',
  'industry',
  'lifecycle_stage',
] as const;

export class GetCompaniesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  lifecycle_stage?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(250)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  sortBy?: string = 'updated_at';

  @IsOptional()
  @IsString()
  sortOrder?: string = 'DESC';

  @IsOptional()
  @IsString()
  includeStats?: string;

  @IsOptional()
  @IsString()
  mode?: string;
}
