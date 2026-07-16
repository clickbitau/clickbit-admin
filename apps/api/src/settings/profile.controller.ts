import { Body, Controller, Delete, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProfileService } from './profile.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/settings.dto';

@Controller('profile')
@UseGuards(SupabaseAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Req() req: Request) { return this.profileService.getProfile(req.user as any); }

  @Put()
  updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) { return this.profileService.updateProfile(req.user as any, dto as any); }

  @Put('password')
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) { return this.profileService.changePassword(req.user as any, dto as any); }

  @Put('notifications')
  updateNotifications(@Req() req: Request, @Body() dto: any) { return this.profileService.updateNotifications(req.user as any, dto); }

  @Delete()
  deleteAccount(@Req() req: Request, @Body() body: any) { return this.profileService.deleteAccount(req.user as any, body?.password); }
}
