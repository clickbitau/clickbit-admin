import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const DEAL_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const DEAL_STATUSES = ['open', 'won', 'lost'] as const;

export class GetDealsQueryDto {
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
  @IsIn(DEAL_STATUSES)
  status?: typeof DEAL_STATUSES[number];

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contact_id?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(DEAL_PRIORITIES)
  priority?: typeof DEAL_PRIORITIES[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @IsOptional()
  @IsString()
  sortOrder?: string = 'DESC';
}

export class CreateDealDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  value?: number | string;

  @IsOptional()
  @IsString()
  currency?: string = 'AUD';

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
  contact_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  company_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner_id?: number;

  @IsOptional()
  @IsString()
  expected_close_date?: string;

  @IsOptional()
  @IsString()
  lead_source?: string;

  @IsOptional()
  @IsIn(DEAL_PRIORITIES)
  priority?: typeof DEAL_PRIORITIES[number] = 'medium';

  @IsOptional()
  @IsIn(DEAL_STATUSES)
  status?: typeof DEAL_STATUSES[number];

  @IsOptional()
  custom_fields?: Record<string, unknown>;

  @IsOptional()
  tags?: string[];
}

export class UpdateDealDto extends CreateDealDto {}

export class MoveDealDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stage_id!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  position?: number;
}

export class WonDealDto {
  @IsOptional()
  @IsString()
  won_reason?: string;

  @IsOptional()
  @IsBoolean()
  create_portal_access?: boolean = true;
}

export class LostDealDto {
  @IsOptional()
  @IsString()
  lost_reason?: string;

  @IsOptional()
  @IsString()
  competitor?: string;
}

export class BulkUpdateDealsDto {
  @IsInt({ each: true })
  deal_ids!: number[];

  updates!: Record<string, unknown>;
}

export class BulkDeleteDealsDto {
  @IsInt({ each: true })
  deal_ids!: number[];
}

export class CreateProjectFromDealDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  manager_id?: number;

  @IsOptional()
  @IsString()
  project_type?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  due_date?: string;
}
