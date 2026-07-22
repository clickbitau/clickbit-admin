import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from './common.dto';

export const PROJECT_STATUSES = ['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const;
export const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export class GetProjectsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  mode?: string;
}

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: typeof PROJECT_STATUSES[number] = 'not_started';

  @IsOptional()
  @IsIn(PROJECT_PRIORITIES)
  priority?: typeof PROJECT_PRIORITIES[number] = 'medium';

  @IsOptional()
  budget?: number | string;

  @IsOptional()
  @IsString()
  currency?: string = 'AUD';

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  due_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id?: number;

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
  manager_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  created_by?: number;

  @IsOptional()
  @IsString()
  project_type?: string;

  @IsOptional()
  @IsBoolean()
  customer_visible?: boolean;

  @IsOptional()
  custom_fields?: Record<string, unknown>;

  @IsOptional()
  tags?: string[];

  @IsOptional()
  @IsString()
  support_period_type?: string;

  @IsOptional()
  @IsString()
  support_start_date?: string;

  @IsOptional()
  @IsString()
  support_end_date?: string;

  @IsOptional()
  support_price?: number | string;

  @IsOptional()
  @IsString()
  support_currency?: string = 'AUD';

  @IsOptional()
  @IsString()
  support_notes?: string;

  @IsOptional()
  hourly_rate?: number | string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class ProjectStatusDto {
  @IsIn(PROJECT_STATUSES)
  status!: typeof PROJECT_STATUSES[number];

  @IsOptional()
  @IsNumber()
  completion_percentage?: number;
}

export class CreateProjectTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string = 'todo';

  @IsOptional()
  @IsString()
  priority?: string = 'medium';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigned_to?: number;

  @IsOptional()
  estimated_hours?: number | string;

  @IsOptional()
  @IsString()
  due_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parent_task_id?: number;

  @IsOptional()
  tags?: string[];
}

export class CreateSubprojectDto extends CreateProjectDto {}

export class UpdateSubprojectDto extends PartialType(CreateProjectDto) {}

export class CreateMeetingDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  participants?: string;

  @IsString()
  meeting_date!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration_minutes?: number = 60;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string = 'scheduled';
}

export class UpdateMeetingDto extends PartialType(CreateMeetingDto) {}

export class ProjectDocumentUploadDto {
  @IsOptional()
  @IsString()
  file_name?: string;
}

export class SendSupportEmailDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
