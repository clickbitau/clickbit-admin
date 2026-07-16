import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
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

  @Get('verify-email')
  async verifyEmailGet(@Query() query: any, @Res() res: any) {
    const frontendUrl = (process.env.FRONTEND_URL || 'https://clickbit.com.au').replace(/\/$/, '');
    try {
      const result = await this.authService.verifyEmail(query || {});
      return res.redirect(result.redirectUrl || `${frontendUrl}/login?verified=true`);
    } catch (error: any) {
      const message = encodeURIComponent(error?.message || 'verification-failed');
      return res.redirect(`${frontendUrl}/login?error=${message}`);
    }
  }

  @Get('linked-accounts')
  @UseGuards(SupabaseAuthGuard)
  linkedAccounts(@Req() req: RequestWithUser) { return this.authService.linkedAccounts(req.user); }

  @Post('link-provider')
  @UseGuards(SupabaseAuthGuard)
  linkProvider(@Req() req: RequestWithUser, @Body() body: any) { return this.authService.linkProvider(req.user, body || {}); }

  @Delete('unlink-provider/:provider')
  @UseGuards(SupabaseAuthGuard)
  unlinkProvider(@Req() req: RequestWithUser, @Param('provider') provider: string) { return this.authService.unlinkProvider(req.user, provider); }

  @Post('social-login')
  socialLogin(@Body() body: any) { return this.authService.socialLogin(body || {}); }
}
