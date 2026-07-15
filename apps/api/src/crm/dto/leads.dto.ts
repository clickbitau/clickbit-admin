import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from './common.dto';

export const LEAD_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export class GetLeadsQueryDto extends PaginationQueryDto {
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
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner_id?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(LEAD_PRIORITIES)
  priority?: typeof LEAD_PRIORITIES[number];
}

export class CreateLeadDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  job_title?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  pipeline_id!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  stage_id!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contact_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  company_id?: number;

  @IsOptional()
  estimated_value?: number | string;

  @IsOptional()
  @IsString()
  currency?: string = 'AUD';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  probability?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  lead_score?: number;

  @IsOptional()
  @IsString()
  lead_source?: string;

  @IsOptional()
  @IsIn(LEAD_PRIORITIES)
  priority?: typeof LEAD_PRIORITIES[number];

  @IsOptional()
  @IsString()
  expected_close_date?: string;

  @IsOptional()
  custom_fields?: Record<string, unknown>;

  @IsOptional()
  tags?: string[];
}

export class UpdateLeadDto extends CreateLeadDto {}

export class MoveLeadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stage_id!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  position?: number;
}

export class WinLeadDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @Type(() => Boolean)
  create_deal?: boolean;

  @IsOptional()
  @IsString()
  deal_title?: string;
}

export class LoseLeadDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  competitor?: string;
}
