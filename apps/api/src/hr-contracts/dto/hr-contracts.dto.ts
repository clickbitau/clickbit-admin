import { IsOptional, IsString, IsNumberString, IsObject, IsDateString, IsIn } from 'class-validator';

export class CreateContractDto {
  @IsNumberString()
  employee_id: string;

  @IsDateString()
  start_date: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsDateString()
  renewal_date?: string;

  @IsOptional()
  @IsIn(['full_time', 'part_time', 'casual', 'contractor', 'intern'])
  employment_type?: 'full_time' | 'part_time' | 'casual' | 'contractor' | 'intern';

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsNumberString()
  manager_id?: string;

  @IsOptional()
  @IsString()
  hourly_rate?: string;

  @IsOptional()
  @IsString()
  salary?: string;

  @IsOptional()
  @IsIn(['weekly', 'fortnightly', 'monthly'])
  pay_frequency?: 'weekly' | 'fortnightly' | 'monthly';

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  default_weekly_hours?: string;

  @IsOptional()
  @IsObject()
  work_schedule?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  terms_summary?: string;

  @IsOptional()
  @IsString()
  change_reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  responsibilities?: string;

  @IsOptional()
  @IsString()
  work_address?: string;

  @IsOptional()
  @IsString()
  work_city?: string;

  @IsOptional()
  @IsString()
  work_state?: string;

  @IsOptional()
  @IsString()
  work_country?: string;

  @IsOptional()
  @IsString()
  work_postcode?: string;

  @IsOptional()
  @IsString()
  work_timezone?: string;
}

export class UpdateContractDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsIn(['full_time', 'part_time', 'casual', 'contractor', 'intern'])
  employment_type?: 'full_time' | 'part_time' | 'casual' | 'contractor' | 'intern';

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsNumberString()
  manager_id?: string;

  @IsOptional()
  @IsString()
  hourly_rate?: string;

  @IsOptional()
  @IsString()
  salary?: string;

  @IsOptional()
  @IsIn(['weekly', 'fortnightly', 'monthly'])
  pay_frequency?: 'weekly' | 'fortnightly' | 'monthly';

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  default_weekly_hours?: string;

  @IsOptional()
  @IsObject()
  work_schedule?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  renewal_date?: string;

  @IsOptional()
  @IsString()
  terms_summary?: string;

  @IsOptional()
  @IsString()
  change_reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  responsibilities?: string;

  @IsOptional()
  @IsString()
  work_address?: string;

  @IsOptional()
  @IsString()
  work_city?: string;

  @IsOptional()
  @IsString()
  work_state?: string;

  @IsOptional()
  @IsString()
  work_country?: string;

  @IsOptional()
  @IsString()
  work_postcode?: string;

  @IsOptional()
  @IsString()
  work_timezone?: string;
}

export class ListContractsQueryDto {
  @IsOptional()
  @IsNumberString()
  employee_id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  self?: string;
}

export class TerminateContractDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
