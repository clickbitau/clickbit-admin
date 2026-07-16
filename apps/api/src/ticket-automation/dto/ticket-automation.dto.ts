import { IsOptional, IsString, IsNumberString, IsBoolean, IsInt, IsIn } from 'class-validator';

export class CreateCustomerRepositoryDto {
  @IsOptional()
  @IsNumberString()
  profile_id?: string;

  @IsOptional()
  @IsNumberString()
  company_id?: string;

  @IsString()
  repo_full_name: string;

  @IsOptional()
  @IsBoolean()
  auto_fix_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  require_approval?: boolean;
}

export class UpdateCustomerRepositoryDto {
  @IsOptional()
  @IsNumberString()
  profile_id?: string;

  @IsOptional()
  @IsNumberString()
  company_id?: string;

  @IsOptional()
  @IsString()
  repo_full_name?: string;

  @IsOptional()
  @IsBoolean()
  auto_fix_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  require_approval?: boolean;
}

export class UpdateQuotaDto {
  @IsOptional()
  @IsInt()
  free_limit?: number;

  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  period?: 'weekly' | 'monthly';

  @IsOptional()
  @IsInt()
  price_cents?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
