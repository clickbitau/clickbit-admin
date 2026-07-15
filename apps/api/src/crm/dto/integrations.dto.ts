import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class IntegrationCreateDealDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pipeline_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stage_id?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  value?: number | string;
}

export class LinkProjectDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  project_id!: number;
}
