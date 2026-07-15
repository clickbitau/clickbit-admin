import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const NOTE_TYPES = ['general', 'call', 'meeting', 'internal', 'important'] as const;

export class GetNotesQueryDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
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
  is_pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  is_private?: boolean;

  @IsOptional()
  attachments?: Record<string, unknown>[];

  @IsOptional()
  mentions?: number[];
}

export class UpdateNoteDto extends CreateNoteDto {}
