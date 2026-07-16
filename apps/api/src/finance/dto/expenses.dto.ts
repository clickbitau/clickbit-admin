import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  enum_expenses_category,
  enum_expenses_payment_method,
  enum_expenses_status,
} from '@prisma/client';
import { PaginationQueryDto } from './common.dto';

export class GetExpensesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(enum_expenses_category)
  category?: enum_expenses_category;

  @IsOptional()
  @IsEnum(enum_expenses_status)
  status?: enum_expenses_status;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  is_billable?: string;

  @IsOptional()
  @IsString()
  is_reimbursable?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employee_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  invoice_id?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ExpenseLineItemDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @Type(() => Number)
  size?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  uploadedAt?: string;
}

export class CreateExpenseDto {
  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(enum_expenses_category)
  category?: enum_expenses_category;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  vendor_name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vendor_id?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax_rate?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsDateString()
  expense_date!: string;

  @IsOptional()
  @IsEnum(enum_expenses_payment_method)
  payment_method?: enum_expenses_payment_method;

  @IsOptional()
  @IsString()
  payment_reference?: string;

  @IsOptional()
  @IsString()
  paid_from_account?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_reimbursable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reimbursed_to?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  project_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deal_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  crm_project_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  crm_subproject_id?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_billable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employee_id?: number;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsArray()
  receipts?: ExpenseLineItemDto[];
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

export class AddReceiptToExpenseDto {
  @IsString()
  name!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @Type(() => Number)
  size?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class AddToInvoiceDto {
  @Type(() => Number)
  @IsInt()
  invoice_id!: number;
}

export class RejectExpenseDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReimburseExpenseDto {
  @IsOptional()
  @IsString()
  reference?: string;
}

export class GetReceiptsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}

export class CreateReceiptDto {
  @IsString()
  file_name!: string;

  @IsString()
  file_url!: string;

  @IsOptional()
  @Type(() => Number)
  file_size?: number;

  @IsOptional()
  @IsString()
  file_type?: string;

  @IsOptional()
  @IsString()
  vendor_name?: string;

  @IsOptional()
  @IsDateString()
  receipt_date?: string;

  @IsOptional()
  @Type(() => Number)
  subtotal?: number;

  @IsOptional()
  @Type(() => Number)
  tax_amount?: number;

  @IsOptional()
  @Type(() => Number)
  total_amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vendor_id?: number;
}

export class UpdateReceiptDto extends PartialType(CreateReceiptDto) {}

export class LinkReceiptToExpenseDto {
  @Type(() => Number)
  @IsInt()
  expense_id!: number;
}

export class CreateExpenseFromReceiptDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsDateString()
  expense_date?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  vendor_name?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_reimbursable?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  tax_amount?: number;

  @IsOptional()
  @Type(() => Number)
  tax_rate?: number;

  @IsOptional()
  @Type(() => Number)
  project_id?: number;

  @IsOptional()
  @Type(() => Number)
  deal_id?: number;

  @IsOptional()
  @Type(() => Number)
  crm_project_id?: number;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_billable?: boolean;
}
