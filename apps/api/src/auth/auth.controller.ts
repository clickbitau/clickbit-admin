import { Body, Controller, Delete, Get, Optional, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { PasskeysService } from './passkeys.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { RequestWithUser } from '../types/request-with-user';
import {
  BackupCodeVerifyDto,
  CheckTrustDto,
  ForgotPasswordDto,
  GenerateBackupCodesDto,
  LinkProviderDto,
  LoginDto,
  MagicLinkDto,
  OAuthCallbackDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordCodeDto,
  ResetPasswordDto,
  SocialLoginDto,
  TrustDeviceDto,
  VerifyEmailDto,
} from './dto';

function getRequestOrigin(req: any): string | undefined {
  const origin = req?.headers?.origin || req?.headers?.referer || req?.headers?.['x-forwarded-origin'];
  if (typeof origin === 'string' && origin.startsWith('http')) return origin.replace(/\/$/, '');
  return undefined;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Optional() private readonly passkeysService?: PasskeysService,
  ) {}

  @Get('config')
  config() { return this.authService.getPublicConfig(); }

  @Post('register')
  async register(@Body() body: RegisterDto) { return this.authService.register(body || {}); }

  @Post('login')
  async login(@Body() body: LoginDto) { return this.authService.login(body || {}); }

  @Post('logout')
  @UseGuards(SupabaseAuthGuard)
  async logout(@Req() req: RequestWithUser) { return this.authService.logout(req.user); }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async me(@Req() req: RequestWithUser) { return this.authService.me(req.user); }

  @Get('mfa/factors')
  @UseGuards(SupabaseAuthGuard)
  async mfaFactors(@Req() req: RequestWithUser) { return this.authService.listMfaFactors(req.user); }

  @Get('mfa/backup-codes')
  @UseGuards(SupabaseAuthGuard)
  async listBackupCodes(@Req() req: RequestWithUser) { return this.authService.listBackupCodes(req.user); }

  @Post('mfa/backup-codes')
  @UseGuards(SupabaseAuthGuard)
  async generateBackupCodes(@Req() req: RequestWithUser, @Body() body: GenerateBackupCodesDto) {
    return this.authService.generateBackupCodes(req.user, Number(body?.count || 10));
  }

  @Post('mfa/backup-codes/verify')
  @UseGuards(SupabaseAuthGuard)
  async verifyBackupCode(@Req() req: RequestWithUser, @Body() body: BackupCodeVerifyDto) {
    return this.authService.verifyBackupCode(req.user, body.code);
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshDto) { return this.authService.refresh(body || {}); }

  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) { return this.authService.forgotPassword(body || {}); }

  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) { return this.authService.resetPassword(body || {}); }

  @Post('reset-password-code')
  async resetPasswordWithCode(@Body() body: ResetPasswordCodeDto) { return this.authService.resetPasswordWithCode(body || {}); }

  @Post('verify-email')
  async resendVerification(@Body() body: VerifyEmailDto) { return this.authService.resendVerification(body || {}); }

  @Post('magic-link')
  async magicLink(@Body() body: MagicLinkDto) { return this.authService.magicLink(body || {}); }

  @Post('oauth/callback')
  oauthCallback(@Body() body: OAuthCallbackDto) { return this.authService.oauthCallback(body || {}); }

  @Get('callback')
  authCallback(@Query() query: any) { return this.authService.authCallback(query || {}); }

  @Delete('account')
  @UseGuards(SupabaseAuthGuard)
  async deleteAccount(@Req() req: RequestWithUser) { return this.authService.deleteAccount(req.user); }

  @Post('trust-device')
  @UseGuards(SupabaseAuthGuard)
  trustDevice(@Req() req: RequestWithUser, @Body() body: TrustDeviceDto) { return this.authService.trustDevice(req.user, body || {}); }

  @Post('check-trust')
  @UseGuards(SupabaseAuthGuard)
  checkTrust(@Req() req: RequestWithUser, @Body() body: CheckTrustDto) { return this.authService.checkTrust(req.user, body || {}); }

  @Get('trusted-devices')
  @UseGuards(SupabaseAuthGuard)
  trustedDevices(@Req() req: RequestWithUser) { return this.authService.trustedDevices(req.user); }

  @Delete('trusted-devices/:id')
  @UseGuards(SupabaseAuthGuard)
  removeTrustedDevice(@Req() req: RequestWithUser, @Param('id') id: string) { return this.authService.removeTrustedDevice(req.user, id); }

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
  linkProvider(@Req() req: RequestWithUser, @Body() body: LinkProviderDto) { return this.authService.linkProvider(req.user, body || {}); }

  @Delete('unlink-provider/:provider')
  @UseGuards(SupabaseAuthGuard)
  unlinkProvider(@Req() req: RequestWithUser, @Param('provider') provider: string) { return this.authService.unlinkProvider(req.user, provider); }

  @Post('social-login')
  socialLogin(@Body() body: SocialLoginDto) { return this.authService.socialLogin(body || {}); }

  // Passkeys
  @Post('passkeys/register-options')
  @UseGuards(SupabaseAuthGuard)
  passkeyRegisterOptions(@Req() req: RequestWithUser) { return this.passkeysService!.generateRegistrationOptions(req.user, getRequestOrigin(req)); }

  @Post('passkeys/register')
  @UseGuards(SupabaseAuthGuard)
  passkeyRegister(@Req() req: RequestWithUser, @Body() body: any) { return this.passkeysService!.verifyRegistration(req.user, body, getRequestOrigin(req)); }

  @Get('passkeys')
  @UseGuards(SupabaseAuthGuard)
  listPasskeys(@Req() req: RequestWithUser) { return this.passkeysService!.listPasskeys(req.user); }

  @Delete('passkeys/:id')
  @UseGuards(SupabaseAuthGuard)
  deletePasskey(@Req() req: RequestWithUser, @Param('id') id: string) { return this.passkeysService!.deletePasskey(req.user, Number(id)); }

  @Post('passkeys/login-options')
  passkeyLoginOptions(@Req() req: Request) { return this.passkeysService!.generateLoginOptions(getRequestOrigin(req)); }

  @Post('passkeys/login')
  passkeyLogin(@Req() req: Request, @Body() body: any) { return this.passkeysService!.verifyLogin(body, getRequestOrigin(req)); }
}
