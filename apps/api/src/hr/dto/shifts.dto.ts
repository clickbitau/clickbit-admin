import { IsArray, IsDateString, IsInt, IsNumberString, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class ShiftQueryDto {
  @IsOptional() @IsNumberString() employee_id?: string;
  @IsOptional() @IsDateString() start_date?: string;
  @IsOptional() @IsDateString() end_date?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() department?: string;
}

export class ShiftCreateDto {
  @IsNumberString() employee_id!: string;
  @IsDateString() shift_date!: string;
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/) start_time!: string;
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/) end_time!: string;
  @IsOptional() @IsInt() scheduled_break_minutes?: number;
  @IsOptional() @IsString() shift_type?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() internal_notes?: string;
  @IsOptional() @IsNumberString() overtime_rate?: string;
  @IsOptional() @IsArray() tasks?: any[];
  @IsOptional() location_coordinates?: any;
}

export class ShiftBatchDto {
  @IsNumberString() employee_id!: string;
  @IsArray() @IsDateString(undefined, { each: true }) dates!: string[];
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/) start_time!: string;
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/) end_time!: string;
  @IsOptional() @IsString() shift_type?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsInt() scheduled_break_minutes?: number;
}

export class ShiftPublishDto {
  @IsArray() @IsInt({ each: true }) @Type(() => Number) shift_ids!: number[];
}

export class ShiftCopyWeekDto {
  @IsDateString() source_week_start!: string;
  @IsDateString() target_week_start!: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) employee_ids?: number[];
}

export class OpenShiftQueryDto {
  @IsOptional() @IsDateString() start_date?: string;
  @IsOptional() @IsDateString() end_date?: string;
}
