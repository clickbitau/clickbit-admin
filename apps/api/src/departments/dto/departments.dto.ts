import { IsOptional, IsString, IsBoolean, IsNumberString } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsNumberString()
  company_id?: string;

  @IsOptional()
  @IsNumberString()
  parent_department_id?: string;

  @IsOptional()
  @IsNumberString()
  head_id?: string;

  @IsOptional()
  @IsString()
  budget_allocated?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsNumberString()
  company_id?: string;

  @IsOptional()
  @IsNumberString()
  parent_department_id?: string;

  @IsOptional()
  @IsNumberString()
  head_id?: string;

  @IsOptional()
  @IsString()
  budget_allocated?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
