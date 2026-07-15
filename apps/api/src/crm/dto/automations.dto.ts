import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from './common.dto';

export const TRIGGER_TYPES = ['deal_stage_changed', 'lead_created', 'contact_lifecycle_changed', 'task_overdue', 'email_opened', 'manual'] as const;
export const ACTION_TYPES = ['send_email', 'create_task', 'update_field', 'webhook', 'update_lead_score', 'change_lifecycle_stage'] as const;
export const TARGET_ENTITIES = ['contact', 'company', 'deal', 'lead', 'user'] as const;

export class GetAutomationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  is_active?: string;

  @IsOptional()
  @IsString()
  trigger_type?: string;
}

export class CreateAutomationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(TRIGGER_TYPES)
  trigger_type!: typeof TRIGGER_TYPES[number];

  @IsOptional()
  trigger_conditions?: Record<string, unknown>;

  @IsIn(ACTION_TYPES)
  action_type!: typeof ACTION_TYPES[number];

  @IsOptional()
  action_config?: Record<string, unknown>;

  @IsOptional()
  @IsIn(TARGET_ENTITIES)
  target_entity?: typeof TARGET_ENTITIES[number] = 'contact';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  delay_minutes?: number;
}

export class UpdateAutomationDto extends CreateAutomationDto {}

export class TestAutomationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  entity_id?: number;
}
