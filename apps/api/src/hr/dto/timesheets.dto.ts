import { IsArray, IsInt, IsISO8601, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class TimesheetQueryDto {
  @IsOptional() @IsNumberString() employee_id?: string;
  @IsOptional() @IsISO8601() start_date?: string;
  @IsOptional() @IsISO8601() end_date?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsNumberString() page?: string;
  @IsOptional() @IsNumberString() limit?: string;
}

export class TimesheetEditDto {
  @IsOptional() @IsISO8601() clock_in_time?: string;
  @IsOptional() @IsISO8601() clock_out_time?: string;
  @IsOptional() @IsInt() break_minutes?: number;
  @IsNotEmpty() @IsString() reason!: string;
}

export class TimesheetRejectDto {
  @IsOptional() @IsString() reason?: string;
}

export class WorkItemDto {
  @IsOptional() @IsNumberString() task_id?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumberString() hours_spent?: string;
  @IsOptional() @IsNumberString() project_id?: string;
  @IsOptional() @IsNumberString() crm_project_id?: string;
}

export class ManualTimesheetDto {
  @IsOptional() @IsNumberString() employee_id?: string;
  @IsISO8601() clock_in_time!: string;
  @IsOptional() @IsISO8601() clock_out_time?: string;
  @IsOptional() @IsInt() break_minutes?: number;
  @IsNotEmpty() @IsString() reason!: string;
  @IsOptional() @IsString() notes?: string;
}

export class BulkDeleteTimesheetsDto {
  @IsArray() @IsInt({ each: true }) @Type(() => Number) ids!: number[];
}

export class SummaryQueryDto {
  @IsOptional() @IsISO8601() start_date?: string;
  @IsOptional() @IsISO8601() end_date?: string;
}
