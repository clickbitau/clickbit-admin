import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class TrackEventDto {
  @IsOptional()
  @IsString()
  event_type?: string;

  @IsOptional()
  @IsString()
  event_name?: string;

  @IsOptional()
  @IsString()
  page_url?: string;

  @IsOptional()
  @IsString()
  page_title?: string;

  @IsOptional()
  @IsString()
  referrer_url?: string;

  @IsOptional()
  @IsString()
  device_type?: string;

  @IsOptional()
  @IsString()
  browser?: string;

  @IsOptional()
  @IsString()
  operating_system?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  utm_source?: string;

  @IsOptional()
  @IsString()
  utm_medium?: string;

  @IsOptional()
  @IsString()
  utm_campaign?: string;

  @IsOptional()
  @IsString()
  user_agent?: string;

  @IsOptional()
  @IsString()
  session_id?: string;
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsNumberString()
  period?: string;

  @IsOptional()
  @IsString()
  page_url?: string;
}

export class ExportBigQueryDto {
  @IsOptional()
  @IsNumberString()
  period?: string;
}

export class AudienceExportDto {
  @IsOptional()
  @IsString()
  format?: string;
}
