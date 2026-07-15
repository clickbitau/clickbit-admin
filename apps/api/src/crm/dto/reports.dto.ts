import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ForecastQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  months?: number = 3;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pipeline_id?: number;
}

export class VelocityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number = 90;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pipeline_id?: number;
}
