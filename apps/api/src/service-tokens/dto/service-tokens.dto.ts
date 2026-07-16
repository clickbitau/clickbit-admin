import { IsOptional, IsString, IsInt, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceTokenDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  scopes?: string[] = ['bug_reports'];

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expires_in_days?: number;
}
