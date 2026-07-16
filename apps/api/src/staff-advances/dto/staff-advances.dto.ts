import { IsOptional, IsString, IsNumberString, IsIn, IsDateString } from 'class-validator';

export class CreateAdvanceDto {
  @IsNumberString()
  employee_id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumberString()
  total_amount: string;

  @IsOptional()
  @IsIn(['asset', 'cash', 'pay'])
  advance_type?: string;

  @IsDateString()
  advance_date: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAdvanceDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  advance_type?: string;

  @IsOptional()
  @IsDateString()
  advance_date?: string;
}

export class RejectAdvanceDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateDeductionDto {
  @IsNumberString()
  amount: string;

  @IsDateString()
  deduction_date: string;

  @IsOptional()
  @IsIn(['pay_deduction', 'manual'])
  deduction_type?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RequestAdvanceDto {
  @IsString()
  title: string;

  @IsNumberString()
  total_amount: string;

  @IsOptional()
  @IsString()
  advance_type?: string;

  @IsOptional()
  @IsString()
  notes_employee?: string;

  @IsOptional()
  @IsDateString()
  pay_period_start?: string;

  @IsOptional()
  @IsDateString()
  pay_period_end?: string;
}

export class ListAdvancesQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumberString()
  employee_id?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
