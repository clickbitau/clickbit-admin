import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsBoolean, IsHexColor, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export const PIPELINE_TYPES = ['sales', 'marketing', 'support', 'custom'] as const;

export class CreatePipelineDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(PIPELINE_TYPES)
  pipeline_type?: typeof PIPELINE_TYPES[number] = 'sales';

  @IsOptional()
  @IsString()
  currency?: string = 'AUD';

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class UpdatePipelineDto extends PartialType(CreatePipelineDto) {}

export class PipelineStageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Min(0)
  probability?: number;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  is_won?: boolean;

  @IsOptional()
  @IsBoolean()
  is_lost?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rotting_days?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePipelineStagesDto {
  @Type(() => PipelineStageDto)
  stages!: PipelineStageDto[];
}
