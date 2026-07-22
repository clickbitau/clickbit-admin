import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  password: string;
}

export class VerifyEmailDto {
  @IsEmail()
  email: string;
}

export class MagicLinkDto {
  @IsEmail()
  email: string;
}

export class OAuthCallbackDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  id_token?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  nonce?: string;
}

export class TrustDeviceDto {
  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}

export class CheckTrustDto {
  @IsString()
  token: string;
}

export class LinkProviderDto {
  @IsString()
  provider: string;

  @IsString()
  provider_id: string;

  @IsOptional()
  @IsString()
  provider_email?: string;
}

export class SocialLoginDto {
  @IsOptional()
  @IsString()
  access_token?: string;

  @IsOptional()
  @IsString()
  refresh_token?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  provider_id?: string;
}

export class GenerateBackupCodesDto {
  @IsOptional()
  count?: number | string;
}

export class BackupCodeVerifyDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;
}
