import { IsOptional, IsString, IsInt, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkspaceDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
}

export class UpdateWorkspaceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
}

export class CreateDirectMessageDto {
  @IsOptional() @IsString() name?: string;
  @IsArray() @IsInt({ each: true }) participant_ids!: number[];
  @IsOptional() @IsString() type?: 'dm' | 'group';
}

export class UpdateDirectMessageDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() avatar_url?: string;
}

export class CreateChannelDto {
  @IsString() name!: string;
  @IsInt() workspace_id!: number;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() is_private?: boolean;
}

export class ReadConversationDto {
  @IsOptional() @Type(() => Number) @IsInt() last_read_message_id?: number;
}

export class ConversationPreferencesDto {
  @IsString() conversation_type!: 'channel' | 'direct_message';
  @IsInt() conversation_id!: number;
  @IsOptional() @IsBoolean() is_muted?: boolean;
  @IsOptional() @IsString() notification_level?: string;
  @IsOptional() @IsBoolean() sound_enabled?: boolean;
}

export class ListMessagesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() limit?: number = 50;
  @IsOptional() @Type(() => Number) @IsInt() before?: number;
  @IsOptional() @Type(() => Number) @IsInt() after?: number;
}

export class CreateMessageDto {
  @IsOptional() @Type(() => Number) @IsInt() channelId?: number;
  @IsOptional() @Type(() => Number) @IsInt() directMessageId?: number;
  @IsOptional() @Type(() => Number) @IsInt() parentMessageId?: number;
  @IsOptional() @IsString() content?: string;
  @IsOptional() attachments?: unknown[];
}

export class UpdateMessageDto {
  @IsString() content!: string;
}

export class ReactionDto {
  @IsString() emoji!: string;
}

export class SearchMessagesDto {
  @IsString() query!: string;
  @IsOptional() @Type(() => Number) @IsInt() channel_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() direct_message_id?: number;
}

export class MailAccountDto {
  @IsString() email!: string;
  @IsOptional() @IsString() display_name?: string;
  @IsString() imap_host!: string;
  @IsOptional() @Type(() => Number) @IsInt() imap_port?: number;
  @IsOptional() @IsBoolean() imap_secure?: boolean;
  @IsString() smtp_host!: string;
  @IsOptional() @Type(() => Number) @IsInt() smtp_port?: number;
  @IsOptional() @IsBoolean() smtp_secure?: boolean;
  @IsString() username!: string;
  @IsString() password!: string;
  @IsOptional() @IsString() preset?: string;
}

export class UpdateMailAccountDto {
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() display_name?: string;
  @IsOptional() @IsString() imap_host?: string;
  @IsOptional() @Type(() => Number) @IsInt() imap_port?: number;
  @IsOptional() @IsBoolean() imap_secure?: boolean;
  @IsOptional() @IsString() smtp_host?: string;
  @IsOptional() @Type(() => Number) @IsInt() smtp_port?: number;
  @IsOptional() @IsBoolean() smtp_secure?: boolean;
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() signature_html?: string;
  @IsOptional() @IsString() signature_text?: string;
  @IsOptional() aliases?: unknown[];
}

export class SendMailDto {
  @IsString() to_email!: string;
  @IsOptional() @IsString() to_name?: string;
  @IsString() subject!: string;
  @IsOptional() @IsString() body_text?: string;
  @IsOptional() @IsString() body_html?: string;
  @IsOptional() @IsString() template?: string;
}

export class MailTemplateDto {
  @IsString() name!: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() body_text?: string;
  @IsOptional() @IsString() body_html?: string;
}
