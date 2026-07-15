import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateDealFromOrderDto {
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
}

export class LinkInvoiceProjectDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  project_id!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subproject_id?: number;
}
