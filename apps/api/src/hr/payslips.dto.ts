import { IsOptional, IsString, IsNumberString, IsArray, IsBoolean, IsInt, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPayslipsQueryDto {
  @IsOptional()
  @IsNumberString()
  employee_id?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}

export class CalculateSingleDto {
  @IsInt()
  @Type(() => Number)
  employeeId!: number;

  @IsString()
  periodStart!: string;

  @IsString()
  periodEnd!: string;

  @IsString()
  paymentDate!: string;

  @IsOptional()
  @Type(() => Number)
  manualHours?: number;

  @IsOptional()
  @IsObject()
  leaveTaken?: Record<string, unknown>;
}

export class PreviewBackfillDto {
  @IsArray()
  employeeIds!: number[];

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  defaultHours?: number;

  @IsOptional()
  @Type(() => Number)
  paymentDelayDays?: number;
}

export class BulkCreateDto {
  @IsArray()
  payslips!: Record<string, unknown>[];

  @IsOptional()
  @IsBoolean()
  sendEmails?: boolean;
}

export class UpdatePayslipStatusDto {
  @IsString()
  status!: string;
}

export class DeletePayslipDto {
  @IsString()
  confirm!: string;
}
