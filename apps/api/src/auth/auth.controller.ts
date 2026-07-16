import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { RequestWithUser } from '../types/request-with-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) { return this.authService.register(body || {}); }

  @Post('login')
  async login(@Body() body: any) { return this.authService.login(body || {}); }

  @Post('logout')
  @UseGuards(SupabaseAuthGuard)
  async logout(@Req() req: RequestWithUser) { return this.authService.logout(req.user); }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async me(@Req() req: RequestWithUser) { return this.authService.me(req.user); }

  @Post('refresh')
  async refresh(@Body() body: any) { return this.authService.refresh(body || {}); }

  @Post('forgot-password')
  async forgotPassword(@Body() body: any) { return this.authService.forgotPassword(body || {}); }

  @Post('reset-password')
  async resetPassword(@Body() body: any) { return this.authService.resetPassword(body || {}); }

  @Post('verify-email')
  async resendVerification(@Body() body: any) { return this.authService.resendVerification(body || {}); }

  @Post('magic-link')
  async magicLink(@Body() body: any) { return this.authService.magicLink(body || {}); }

  @Post('oauth/callback')
  oauthCallback(@Body() body: any) { return this.authService.oauthCallback(body || {}); }

  @Get('callback')
  authCallback(@Query() query: any) { return this.authService.authCallback(query || {}); }

  @Delete('account')
  @UseGuards(SupabaseAuthGuard)
  async deleteAccount(@Req() req: RequestWithUser) { return this.authService.deleteAccount(req.user); }

  @Post('trust-device')
  @UseGuards(SupabaseAuthGuard)
  trustDevice(@Body() body: any) { return this.authService.trustDevice(body || {}); }

  @Post('check-trust')
  checkTrust(@Body() body: any) { return this.authService.checkTrust(body || {}); }

  @Get('trusted-devices')
  @UseGuards(SupabaseAuthGuard)
  trustedDevices() { return this.authService.trustedDevices(); }

  @Delete('trusted-devices/:id')
  @UseGuards(SupabaseAuthGuard)
  removeTrustedDevice(@Param('id') id: string) { return this.authService.removeTrustedDevice(id); }
}
