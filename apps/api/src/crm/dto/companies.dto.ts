import { PartialType } from '@nestjs/mapped-types';
import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsIn, Min, IsEmail } from 'class-validator';
import { normalizeCompanySize } from '../crm-utils';
import { PaginationQueryDto } from './common.dto';

export const ALLOWED_COMPANY_SORT = [
  'name',
  'updated_at',
  'created_at',
  'city',
  'industry',
  'lifecycle_stage',
] as const;

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;

export class GetCompaniesQueryDto extends PaginationQueryDto {
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
  @IsString()
  includeStats?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  /** When "true", include companies flagged is_demo (excluded from production lists/stats by default). */
  @IsOptional()
  @IsString()
  include_demo?: string;

  @IsOptional()
  @IsIn(ALLOWED_COMPANY_SORT)
  sortBy?: typeof ALLOWED_COMPANY_SORT[number] = 'updated_at';
}

export class CreateCompanyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  contact_person?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeCompanySize(value))
  @IsIn(COMPANY_SIZES)
  company_size?: typeof COMPANY_SIZES[number];

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address_line1?: string;

  @IsOptional()
  @IsString()
  address_line2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  @IsOptional()
  @IsString()
  linkedin_url?: string;

  @IsOptional()
  @IsString()
  twitter_url?: string;

  @IsOptional()
  @IsString()
  facebook_url?: string;

  @IsOptional()
  @IsString()
  lifecycle_stage?: string;

  @IsOptional()
  @IsString()
  lead_source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner_id?: number;

  @IsOptional()
  owner?: { id: number; first_name: string; last_name: string };

  @IsOptional()
  custom_fields?: Record<string, unknown>;

  @IsOptional()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class CompanyDocumentUploadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  is_client_visible?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  expires_at?: string;

  @IsOptional()
  @IsString()
  internal_notes?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
