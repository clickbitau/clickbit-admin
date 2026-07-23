import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

const EMPLOYMENT_TYPE = ['full_time', 'part_time', 'casual', 'contractor', 'intern'] as const;
const EMPLOYMENT_STATUS = ['active', 'on_leave', 'suspended', 'terminated'] as const;
const PAY_FREQUENCY = ['weekly', 'fortnightly', 'monthly'] as const;
const LEAVE_TYPE = ['annual', 'sick', 'personal', 'unpaid', 'bereavement', 'maternity', 'paternity', 'study', 'jury_duty', 'other'] as const;
const PARTIAL_DAY_TYPE = ['morning', 'afternoon', 'custom'] as const;
export const TIME_OFF_STATUS = ['pending', 'approved', 'rejected', 'cancelled', 'withdrawn'] as const;
const ANNOUNCEMENT_TYPE = ['general', 'urgent', 'policy', 'event', 'achievement', 'training', 'safety', 'reminder'] as const;
const ANNOUNCEMENT_PRIORITY = ['low', 'normal', 'high', 'critical'] as const;
const ANNOUNCEMENT_TARGET_TYPE = ['all', 'department', 'position', 'employees', 'managers'] as const;
const ANNOUNCEMENT_STATUS = ['draft', 'scheduled', 'published', 'archived'] as const;
const REMINDER_TRIGGER_TYPE = ['payment', 'project', 'regular'] as const;
const REMINDER_STATUS = ['initiation', 'pending', 'complete'] as const;

class AddressDto {
  @IsOptional()
  @IsString()
  street?: string;

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
}

export class CreateEmployeeDto {
  @Type(() => Number)
  @IsInt()
  user_id: number;

  @IsOptional()
  @IsString()
  employee_number?: string;

  @IsOptional()
  @IsIn(EMPLOYMENT_TYPE)
  employment_type?: string;

  @IsOptional()
  @IsIn(EMPLOYMENT_STATUS)
  employment_status?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  manager_id?: number;

  @IsOptional()
  @IsDateString()
  hire_date?: string;

  @IsOptional()
  @IsDateString()
  termination_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  department_id?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(168)
  default_weekly_hours?: number;

  @IsOptional()
  @Type(() => Number)
  hourly_rate?: number;

  @IsOptional()
  @Type(() => Number)
  salary?: number;

  @IsOptional()
  @IsIn(PAY_FREQUENCY)
  pay_frequency?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  emergency_contact_phone?: string;

  @IsOptional()
  @IsString()
  emergency_contact_relationship?: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  tax_file_number?: string;

  @IsOptional()
  @IsString()
  super_fund_name?: string;

  @IsOptional()
  @IsString()
  super_member_number?: string;

  @IsOptional()
  @IsString()
  bank_account_name?: string;

  @IsOptional()
  @IsString()
  bank_bsb?: string;

  @IsOptional()
  @IsString()
  bank_account_number?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  annual_leave_balance?: number;

  @IsOptional()
  @Type(() => Number)
  sick_leave_balance?: number;

  @IsOptional()
  @Type(() => Number)
  personal_leave_balance?: number;

  @IsOptional()
  @IsBoolean()
  can_clock_in?: boolean;

  @IsOptional()
  @IsBoolean()
  require_gps_clock_in?: boolean;

  @IsOptional()
  @IsBoolean()
  require_photo_clock_in?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_clock_in?: boolean;

  @IsOptional()
  @IsString()
  abn?: string;

  @IsOptional()
  @IsBoolean()
  tax_free_threshold_claimed?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  address_street?: string;

  @IsOptional()
  @IsString()
  city_value?: string;

  @IsOptional()
  @IsString()
  state_value?: string;

  @IsOptional()
  @IsString()
  postcode_value?: string;

  @IsOptional()
  @IsString()
  country_value?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

export class CreateTimeOffDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employee_id?: number;

  @IsIn(LEAVE_TYPE)
  leave_type: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsBoolean()
  is_partial_day?: boolean;

  @IsOptional()
  @IsIn(PARTIAL_DAY_TYPE)
  partial_day_type?: string;

  @IsOptional()
  @IsString()
  partial_start_time?: string;

  @IsOptional()
  @IsString()
  partial_end_time?: string;

  @IsOptional()
  @Type(() => Number)
  total_days?: number;

  @IsOptional()
  @Type(() => Number)
  total_hours?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  substitute_employee_id?: number;
}

export class UpdateTimeOffDto extends PartialType(CreateTimeOffDto) {}

export class TimeOffActionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAnnouncementDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  content_html?: string;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_TYPE)
  type?: string;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITY)
  priority?: string;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_TARGET_TYPE)
  target_type?: string;

  @IsOptional()
  target_departments?: unknown;

  @IsOptional()
  target_positions?: unknown;

  @IsOptional()
  target_employee_ids?: unknown;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_STATUS)
  status?: string;

  @IsOptional()
  @IsDateString()
  publish_at?: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @IsOptional()
  attachments?: unknown;

  @IsOptional()
  @IsString()
  featured_image?: string;

  @IsOptional()
  @IsBoolean()
  require_acknowledgment?: boolean;

  @IsOptional()
  @IsDateString()
  acknowledgment_deadline?: string;

  @IsOptional()
  @IsBoolean()
  allow_comments?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_reactions?: boolean;

  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pin_order?: number;

  @IsOptional()
  @IsBoolean()
  send_push_notification?: boolean;

  @IsOptional()
  @IsBoolean()
  send_email?: boolean;

  @IsOptional()
  @IsBoolean()
  visible_to_customers?: boolean;

  @IsOptional()
  @IsBoolean()
  visible_to_agents?: boolean;

  @IsOptional()
  @IsBoolean()
  visible_to_guests?: boolean;
}

export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {}

export class AnnouncementReactionDto {
  @IsString()
  reaction: string;
}

export class AnnouncementCommentDto {
  @IsString()
  comment: string;
}

export class CreateReminderDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(REMINDER_TRIGGER_TYPE)
  trigger_type?: string;

  @IsDateString()
  reminder_date: string;

  @IsOptional()
  @IsIn(REMINDER_STATUS)
  status?: string;

  @IsOptional()
  @IsBoolean()
  send_email?: boolean;

  @IsOptional()
  @IsString()
  reference_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reference_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigned_to?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateReminderDto extends PartialType(CreateReminderDto) {}

export class CreatePublicHolidayDto {
  @IsString()
  name: string;

  @IsDateString()
  holiday_date: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePublicHolidayDto extends PartialType(CreatePublicHolidayDto) {}

export class ImportPublicHolidaysDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  countryCode?: string;
}

export class GetListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  employee_id?: string;

  @IsOptional()
  @IsString()
  leave_type?: string;

  @IsOptional()
  @IsString()
  trigger_type?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  country?: string;
}
