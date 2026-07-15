import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from './common.dto';

export const AUTOMATION_TRIGGER_TYPES = [
  'deal_stage_changed',
  'deal_created',
  'deal_won',
  'deal_lost',
  'contact_created',
  'contact_updated',
  'contact_lifecycle_changed',
  'activity_completed',
  'activity_overdue',
  'lead_score_threshold',
  'no_activity_days',
  'custom_package_created',
  'order_created',
  'order_status_changed',
  'ticket_created',
  'scheduled',
] as const;

export const AUTOMATION_ACTION_TYPES = [
  'send_email',
  'create_task',
  'create_activity',
  'update_field',
  'assign_owner',
  'add_tag',
  'remove_tag',
  'create_deal',
  'move_deal_stage',
  'send_notification',
  'webhook',
  'update_lead_score',
  'change_lifecycle_stage',
] as const;

export const AUTOMATION_TARGET_ENTITIES = ['contact', 'deal', 'company', 'activity', 'order', 'ticket'] as const;

export class GetAutomationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(AUTOMATION_TRIGGER_TYPES)
  trigger_type?: typeof AUTOMATION_TRIGGER_TYPES[number];

  @IsOptional()
  @IsIn(AUTOMATION_TARGET_ENTITIES)
  target_entity?: typeof AUTOMATION_TARGET_ENTITIES[number];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CreateAutomationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(AUTOMATION_TRIGGER_TYPES)
  trigger_type!: typeof AUTOMATION_TRIGGER_TYPES[number];

  @IsOptional()
  trigger_conditions?: Record<string, unknown>;

  @IsIn(AUTOMATION_ACTION_TYPES)
  action_type!: typeof AUTOMATION_ACTION_TYPES[number];

  @IsOptional()
  action_config?: Record<string, unknown>;

  @IsOptional()
  @IsIn(AUTOMATION_TARGET_ENTITIES)
  target_entity?: typeof AUTOMATION_TARGET_ENTITIES[number] = 'contact';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  delay_minutes?: number = 0;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}

export class UpdateAutomationDto extends CreateAutomationDto {}
