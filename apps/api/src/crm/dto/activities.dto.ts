import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from './common.dto';

export const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'task', 'note', 'lunch', 'deadline', 'follow_up', 'demo', 'other'] as const;
export const ACTIVITY_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled', 'overdue'] as const;
export const ACTIVITY_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export class GetActivitiesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ACTIVITY_TYPES)
  activity_type?: typeof ACTIVITY_TYPES[number];

  @IsOptional()
  @IsIn(ACTIVITY_STATUSES)
  status?: typeof ACTIVITY_STATUSES[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigned_to?: number;

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
  deal_id?: number;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;
}

export class CreateActivityDto {
  @IsIn(ACTIVITY_TYPES)
  activity_type!: typeof ACTIVITY_TYPES[number];

  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(ACTIVITY_STATUSES)
  status?: typeof ACTIVITY_STATUSES[number] = 'planned';

  @IsOptional()
  @IsIn(ACTIVITY_PRIORITIES)
  priority?: typeof ACTIVITY_PRIORITIES[number] = 'medium';

  @IsOptional()
  @IsString()
  due_date?: string;

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
  deal_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigned_to?: number;
}

export class UpdateActivityDto extends CreateActivityDto {}

export class CompleteActivityDto {
  @IsOptional()
  @IsString()
  outcome?: string;
}
