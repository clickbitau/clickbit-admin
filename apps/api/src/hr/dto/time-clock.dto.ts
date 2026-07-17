import { IsArray, IsNumberString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
  @IsOptional()
  @IsNumberString()
  latitude?: string;

  @IsOptional()
  @IsNumberString()
  longitude?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumberString()
  accuracy?: string;
}

export class WorkItemDto {
  @IsOptional()
  @IsNumberString()
  task_id?: number;

  @IsOptional()
  @IsNumberString()
  project_id?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  hours_spent?: string;
}

export class ClockInDto {
  @IsOptional()
  @IsNumberString()
  latitude?: string;

  @IsOptional()
  @IsNumberString()
  longitude?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumberString()
  accuracy?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsOptional()
  @IsNumberString()
  shift_id?: number;
}

export class ClockOutDto extends ClockInDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkItemDto)
  work_items?: WorkItemDto[];

  @IsOptional()
  @IsString()
  session_notes?: string;
}

export class BreakDto {
  @IsOptional()
  @IsString()
  break_type?: string;
}

export class BreadcrumbDto {
  @IsNumberString()
  latitude!: string;

  @IsNumberString()
  longitude!: string;

  @IsOptional()
  @IsNumberString()
  accuracy?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
