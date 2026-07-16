import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const ALLOWED_PAYMENT_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'] as const;

export class GetPaymentsQueryDto {
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
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(ALLOWED_PAYMENT_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'payment_date';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class CreatePaymentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  invoice_id?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  payment_method?: string = 'bank_transfer';

  @IsOptional()
  @IsString()
  payment_provider?: string = 'manual';

  @IsOptional()
  @IsString()
  transaction_id?: string;

  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  gateway_response?: unknown;
}

export class PaymentDateRangeDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
