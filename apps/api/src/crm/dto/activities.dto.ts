import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from './common.dto';

export const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'task', 'note', 'lunch', 'deadline', 'follow_up', 'demo', 'other'] as const;
export const ACTIVITY_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled', 'overdue'] as const;
export const ACTIVITY_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const CALL_DIRECTIONS = ['inbound', 'outbound'] as const;
export const CALL_OUTCOMES = ['connected', 'no_answer', 'busy', 'voicemail', 'wrong_number', 'other'] as const;

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
  duration_minutes?: number;

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

  @IsOptional()
  @IsIn(CALL_DIRECTIONS)
  call_direction?: typeof CALL_DIRECTIONS[number];

  @IsOptional()
  @IsIn(CALL_OUTCOMES)
  call_outcome?: typeof CALL_OUTCOMES[number];

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  meeting_link?: string;

  @IsOptional()
  attendees?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  email_subject?: string;

  @IsOptional()
  @IsString()
  email_body?: string;

  @IsOptional()
  @IsString()
  email_sent_at?: string;

  @IsOptional()
  @IsString()
  email_opened_at?: string;

  @IsOptional()
  @IsString()
  email_clicked_at?: string;

  @IsOptional()
  @IsString()
  reminder_at?: string;

  @IsOptional()
  @IsString()
  completed_at?: string;

  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;

  @IsOptional()
  recurrence_pattern?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parent_activity_id?: number;

  @IsOptional()
  attachments?: Record<string, unknown>[];

  @IsOptional()
  custom_fields?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  outcome?: string;
}

export class UpdateActivityDto extends CreateActivityDto {}

export class CompleteActivityDto {
  @IsOptional()
  @IsString()
  outcome?: string;
}
