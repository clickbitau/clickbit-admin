import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
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

export const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'] as const;
export const TAX_TYPES = ['gst_included', 'gst_calculated', 'no_gst'] as const;
export const TEMPLATE_TYPES = ['tax_excluded', 'tax_included'] as const;

class InvoiceLineItemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unit_price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total?: number;
}

export class GetInvoicesQueryDto {
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  document_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customer?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(250)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC' = 'DESC';
}

export class CreateInvoiceDto {
  @IsString()
  client_name!: string;

  @IsEmail()
  client_email!: string;

  @IsOptional()
  @IsString()
  client_phone?: string;

  @IsOptional()
  @IsString()
  client_company?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  document_type?: string;

  @IsOptional()
  @IsIn(TEMPLATE_TYPES)
  template_type?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  items!: InvoiceLineItemDto[];

  @IsOptional()
  @Type(() => Number)
  discount_amount?: number;

  @IsOptional()
  @IsIn(['amount', 'percentage'])
  discount_type?: string = 'amount';

  @IsOptional()
  @IsIn(TAX_TYPES)
  tax_type?: string = 'gst_included';

  @IsOptional()
  @Type(() => Number)
  tax_rate?: number = 10;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  client_notes?: string;

  @IsOptional()
  @IsDateString()
  valid_until?: string;

  @IsOptional()
  @IsDateString()
  issue_date?: string;

  @IsOptional()
  @IsString()
  source_type?: string;

  @IsOptional()
  @Type(() => Number)
  source_id?: number;

  @IsOptional()
  @Type(() => Number)
  crm_project_id?: number;

  @IsOptional()
  @Type(() => Number)
  crm_subproject_id?: number;

  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: string;
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}

export class RecordPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
