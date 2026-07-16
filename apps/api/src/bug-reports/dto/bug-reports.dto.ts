import { IsOptional, IsString, IsIn, IsNumberString, IsBoolean, IsUrl } from 'class-validator';

export class CreateBugReportDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsIn(['invoice', 'dashboard', 'login', 'crm', 'hr', 'payments', 'other', 'mobile', 'deploy'])
  category?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsUrl()
  screenshot_url?: string;

  @IsOptional()
  @IsBoolean()
  require_approval?: boolean;

  @IsOptional()
  @IsString()
  target_repo?: string;
}

export class UpdateBugReportStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  progress_message?: string;
}

export class MarkFixedDto {
  @IsUrl()
  pull_request_url: string;

  @IsOptional()
  @IsString()
  fix_summary?: string;

  @IsOptional()
  @IsBoolean()
  auto_merge?: boolean;
}

export class ListBugReportsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  target_repo?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsNumberString()
  offset?: string;
}

export class RejectReasonDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
