import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const ALLOWED_SORT_ORDERS = ['ASC', 'DESC'] as const;

export class PaginationQueryDto {
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
  sortBy?: string;

  @IsOptional()
  @IsIn(ALLOWED_SORT_ORDERS)
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class SearchPaginationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
