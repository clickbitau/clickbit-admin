import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsArray,
  IsIn,
  Min,
  IsNumberString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UploadDocumentDto {
  @IsOptional()
  @IsString()
  document_type?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_sensitive?: boolean;

  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @IsOptional()
  @IsString()
  access_level?: string;

  @IsOptional()
  @IsString()
  shared_with_users?: string;

  @IsOptional()
  @IsString()
  shared_with_roles?: string;

  @IsOptional()
  @IsString()
  related_entity_type?: string;

  @IsOptional()
  @IsNumberString()
  related_entity_id?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  expires_at?: string;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  document_type?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_sensitive?: boolean;

  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @IsOptional()
  @IsString()
  access_level?: string;

  @IsOptional()
  @IsString()
  shared_with_users?: string;

  @IsOptional()
  @IsString()
  shared_with_roles?: string;

  @IsOptional()
  @IsString()
  related_entity_type?: string;

  @IsOptional()
  @IsNumberString()
  related_entity_id?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  expires_at?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ShareDocumentDto {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  shared_with_users?: number[];

  @IsOptional()
  @IsArray()
  @Type(() => String)
  shared_with_roles?: string[];
}

export class ListDocumentsQueryDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;

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

  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_order?: string = 'desc';
}
