import { IsOptional, IsString, IsBoolean, IsInt, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class SettingQueryDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
}

export class SettingCreateDto {
  @IsOptional() @IsString() setting_key?: string;
  @IsOptional() @IsString() setting_value?: string;
  @IsOptional() @IsString() setting_type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() is_public?: boolean;
  @IsOptional() @IsBoolean() auto_load?: boolean;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() first_name?: string;
  @IsOptional() @IsString() last_name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() job_title?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() email?: string;
}

export class ChangePasswordDto {
  @IsString() current_password!: string;
  @IsString() new_password!: string;
  @IsString() confirm_password!: string;
}

export class CreateUserDto {
  @IsString() first_name!: string;
  @IsString() last_name!: string;
  @IsEmail() email!: string;
  @IsString() password!: string;
  @IsString() role!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() job_title?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() email_verified?: boolean;
}

export class UpdateUserDto {
  @IsOptional() @IsString() first_name?: string;
  @IsOptional() @IsString() last_name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() job_title?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsBoolean() email_verified?: boolean;
}
