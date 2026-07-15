import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsBoolean, Min, IsIn } from 'class-validator';
import { PaginationQueryDto } from './common.dto';

export const NOTE_TYPES = ['general', 'meeting', 'call', 'email', 'follow_up', 'system'] as const;

export class GetNotesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contact_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  company_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deal_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  activity_id?: number;

  @IsOptional()
  @IsIn(NOTE_TYPES)
  note_type?: typeof NOTE_TYPES[number];
}

export class CreateNoteDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsIn(NOTE_TYPES)
  note_type?: typeof NOTE_TYPES[number] = 'general';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contact_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  company_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deal_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  activity_id?: number;

  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean = false;

  @IsOptional()
  @IsBoolean()
  is_private?: boolean = false;

  @IsOptional()
  attachments?: Record<string, unknown>[];

  @IsOptional()
  mentions?: number[];
}

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}
