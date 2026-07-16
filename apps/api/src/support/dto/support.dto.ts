import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

const TICKET_STATUS = ['open', 'in_progress', 'waiting_customer', 'waiting_staff', 'resolved', 'closed'] as const;
const TICKET_PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;
const TICKET_CATEGORY = ['general', 'technical', 'billing', 'sales', 'feature_request', 'bug_report', 'account', 'other'] as const;
const QUOTA_PERIOD = ['weekly', 'monthly'] as const;

export class CreateTicketDto {
  @IsString()
  subject!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsIn(TICKET_CATEGORY)
  category?: string;

  @IsOptional()
  @IsIn(TICKET_PRIORITY)
  priority?: string;

  @IsOptional()
  @IsString()
  guest_name?: string;

  @IsOptional()
  @IsEmail()
  guest_email?: string;

  @IsOptional()
  @IsInt()
  related_order_id?: number;

  @IsOptional()
  @IsArray()
  attachments?: unknown[];

  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class TrackReplyDto {
  @IsEmail()
  email!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsArray()
  attachments?: unknown[];
}

export class TrackFeedbackDto {
  @IsEmail()
  email!: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}

export class ReplyDto {
  @IsString()
  message!: string;

  @IsOptional()
  @IsBoolean()
  is_internal?: boolean;

  @IsOptional()
  @IsArray()
  attachments?: unknown[];

  @IsOptional()
  @IsIn(TICKET_STATUS)
  update_status?: string;
}

export class UpdateMyAssignedStatusDto {
  @IsIn(TICKET_STATUS)
  status!: string;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsIn(TICKET_STATUS)
  status?: string;

  @IsOptional()
  @IsIn(TICKET_PRIORITY)
  priority?: string;

  @IsOptional()
  @IsIn(TICKET_CATEGORY)
  category?: string;

  @IsOptional()
  @IsInt()
  assigned_to?: number;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  internal_notes?: string;
}

export class BulkUpdateDto {
  @IsArray()
  @IsInt({ each: true })
  ticket_ids!: number[];

  @IsIn(['assign', 'status', 'priority', 'category'])
  action!: string;

  @IsOptional()
  @IsString()
  value?: string;
}

export class MergeTicketsDto {
  @IsInt()
  primary_ticket_id!: number;

  @IsArray()
  @IsInt({ each: true })
  secondary_ticket_ids!: number[];
}

export class TicketListQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  assigned_to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: string;
}

export class CustomerTicketListQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}

export class StaffTicketListQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminStatsQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  period?: number;
}

export class CannedResponsesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CannedResponseItemDto)
  responses!: CannedResponseItemDto[];
}

export class CannedResponseItemDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class CustomerRepositoryDto {
  @IsOptional()
  @IsInt()
  profile_id?: number;

  @IsOptional()
  @IsInt()
  company_id?: number;

  @IsString()
  repo_full_name!: string;

  @IsOptional()
  @IsBoolean()
  auto_fix_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  require_approval?: boolean;
}

export class UpdateCustomerRepositoryDto extends PartialType(CustomerRepositoryDto) {}

export class QuotaDto {
  @IsOptional()
  @IsInt()
  free_limit?: number;

  @IsOptional()
  @IsIn(QUOTA_PERIOD)
  period?: string;

  @IsOptional()
  @IsInt()
  price_cents?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
