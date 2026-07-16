import { IsOptional, IsString, IsInt, IsBoolean, IsArray, IsObject, IsNumberString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTemplateDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  structure?: any[];

  @IsOptional()
  @IsObject()
  workflow_config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  structure?: any[];

  @IsOptional()
  @IsObject()
  workflow_config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}

export class ListTemplatesQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  active_only?: string;
}

export class CreateSubmissionDto {
  @IsNumberString()
  template_id: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateSubmissionStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListSubmissionsQueryDto {
  @IsOptional()
  @IsNumberString()
  template_id?: string;

  @IsOptional()
  @IsNumberString()
  employee_id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  assigned_to_me?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
