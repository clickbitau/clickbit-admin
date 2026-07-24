import { IsOptional, IsString, IsBoolean, IsInt, IsObject, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UptimeKumaWebhookDto {
  @IsOptional()
  @IsObject()
  monitor?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  heartbeat?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  heartbeatJSON?: string;

  @IsOptional()
  @IsString()
  monitorJSON?: string;

  @IsOptional()
  @IsString()
  msg?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  monitorName?: string;

  @IsOptional()
  @IsString()
  monitorUrl?: string;
}

export class UpdateSiteStatusDto {
  @IsString()
  status: string;
}

export class SavePushTokenDto {
  @IsString()
  pushToken: string;
}

export class ListNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unread?: boolean;
}
