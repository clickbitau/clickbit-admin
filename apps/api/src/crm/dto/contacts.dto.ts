import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from './common.dto';

export class GetContactsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  lifecycle_stage?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateContactDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  contact_type?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigned_to?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  company_id?: number;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  job_title?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  lifecycle_stage?: string;

  @IsOptional()
  @IsString()
  lead_status?: string;

  @IsOptional()
  @IsString()
  linkedin_url?: string;

  @IsOptional()
  @IsString()
  twitter_url?: string;

  @IsOptional()
  @IsString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  preferred_contact_method?: string;

  @IsOptional()
  @IsBoolean()
  is_demo?: boolean;

  @IsOptional()
  custom_fields?: Record<string, unknown>;

  @IsOptional()
  tags?: string[];
}

export class UpdateContactDto extends CreateContactDto {}

export class UpdateLeadScoreDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lead_score?: number;

  @IsOptional()
  @IsBoolean()
  recalculate?: boolean;
}

export class UpdateLifecycleStageDto {
  @IsString()
  lifecycle_stage!: string;
}

export class LinkContactCompanyDto {
  @IsInt()
  @Min(1)
  company_id!: number;

  @IsOptional()
  @IsString()
  job_title?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsBoolean()
  is_decision_maker?: boolean;
}

export class ConvertToDealDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pipeline_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stage_id?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  value?: number | string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  expected_close_date?: string;
}

export class PortalAccessBatchDto {
  @IsInt({ each: true })
  contact_ids!: number[];

  @IsOptional()
  @IsBoolean()
  sendWelcomeEmail?: boolean = true;
}
