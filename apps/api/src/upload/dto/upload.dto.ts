import { IsOptional, IsString } from 'class-validator';

export class UploadImageQueryDto {
  @IsOptional()
  @IsString()
  oldImageUrl?: string;

  @IsOptional()
  @IsString()
  slug?: string;
}
