import { Injectable, Logger, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { createTransport } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { RolesService } from './roles.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private adminClient: SupabaseClient | null = null;
  private publicClient: SupabaseClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
    private readonly cache?: CacheService,
  ) {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');
    if (url && serviceKey) {
      this.adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    }
    if (url && anonKey) {
      this.publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    }
  }

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('auth', ...parts) ?? `auth:` + parts.filter((p) => p !== undefined && p !== null).join(':');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }


  private ensureAdmin() {
    if (!this.adminClient) throw new InternalServerErrorException('Supabase Auth is not configured');
    return this.adminClient;
  }

  private ensurePublic() {
    if (!this.publicClient) throw new InternalServerErrorException('Supabase Auth is not configured');
    return this.publicClient;
  }

  private sanitizeProfile(profile: any) {
    if (!profile) return profile;
    const {
      password: _password,
      email_verification_token: _emailVerificationToken,
      password_reset_token: _passwordResetToken,
      ...safe
    } = profile;
    const custom = Array.isArray(safe.permissions)
      ? safe.permissions.filter((p: unknown): p is string => typeof p === 'string')
      : [];
    return {
      ...safe,
      permissions: custom,
      effectivePermissions: this.rolesService.resolveEffectivePermissions(
        safe.role,
        custom,
      ),
    };
  }

  async register(dto: { email: string; password: string; first_name: string; last_name: string; phone?: string }) {
    await this.invalidateCache();

    const { email, password, first_name, last_name, phone } = dto;
    if (!email || !password || !first_name || !last_name) {
      throw new BadRequestException('email, password, first_name, and last_name are required');
    }
    if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const existing = await this.prisma.profiles.findFirst({ where: { email: email.trim().toLowerCase() } });
    if (existing && existing.auth_uid) {
      return { success: true, message: 'If an account with this email doesn\'t exist, you will receive a verification email.' };
    }

    const admin = this.ensureAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: false,
      user_metadata: { first_name, last_name, phone },
    });
    if (error) throw new BadRequestException(error.message);
    const authUid = data.user?.id;

    if (existing) {
      await this.prisma.profiles.update({ where: { id: existing.id }, data: { auth_uid: authUid } });
    } else {
      await this.prisma.profiles.create({
        data: {
          email: email.trim().toLowerCase(),
          auth_uid: authUid,
          first_name,
          last_name,
          phone: phone || null,
          role: 'customer',
          status: 'active',
          email_verified: false,
        } as any,
      });
    }
    return { success: true, message: 'Registration successful! Please check your email to verify your account.' };
  }

  getPublicConfig() {
    return {
      success: true,
      data: {
        supabaseUrl: this.config.get<string>('SUPABASE_URL') || null,
        supabaseAnonKey: this.config.get<string>('SUPABASE_ANON_KEY') || null,
      },
    };
  }

  async login(dto: { email: string; password: string }) {
    await this.invalidateCache();

    const { email, password } = dto;
    if (!email || !password) throw new BadRequestException('email and password are required');
    const publicClient = this.ensurePublic();
    const { data, error } = await publicClient.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.session) throw new BadRequestException(error?.message || 'Invalid credentials');
    const user = await this.getProfileByAuthUid(data.user.id);
    const factors = (data.user.factors || []).filter((f: any) => f.status === 'verified');
    return {
      success: true,
      data: {
        user: this.sanitizeProfile(user),
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        requiresMfa: factors.length > 0,
        factors: factors.map((f: any) => ({ id: f.id, friendly_name: f.friendly_name, factor_type: f.factor_type, status: f.status })),
      },
    };
  }

  async logout(_user: any) {
    await this.invalidateCache();

    const publicClient = this.ensurePublic();
    await publicClient.auth.signOut();
    return { success: true, message: 'Logged out successfully' };
  }

  async me(user: any) {
    return this.cached(this.cacheKey('me', user.id), async () => {

      const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
      if (!profile) throw new BadRequestException('Profile not found');
      return { success: true, data: { user: this.sanitizeProfile(profile) } };


    });
}

  async refresh(dto: { refreshToken: string }) {
    await this.invalidateCache();

    if (!dto.refreshToken) throw new BadRequestException('refreshToken is required');
    const publicClient = this.ensurePublic();
    const { data, error } = await publicClient.auth.refreshSession({ refresh_token: dto.refreshToken });
    if (error || !data.session) throw new BadRequestException(error?.message || 'Invalid refresh token');
    return {
      success: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    };
  }

  async forgotPassword(dto: { email: string; redirect_to?: string }) {
    if (!dto.email) throw new BadRequestException('email is required');
    const email = dto.email.trim().toLowerCase();

    const profile = await this.prisma.profiles.findFirst({ where: { email } });
    if (!profile?.auth_uid) {
      // No local profile linked to Supabase — fall back to the default Supabase email flow.
      const publicClient = this.ensurePublic();
      const { error } = await publicClient.auth.resetPasswordForEmail(email, {
        redirectTo: dto.redirect_to || this.config.get<string>('FRONTEND_URL') || undefined,
      });
      if (error) throw new BadRequestException(error.message);
      return { success: true, message: 'If an account exists, a password reset email has been sent.' };
    }

    const admin = this.ensureAdmin();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: dto.redirect_to || this.config.get<string>('FRONTEND_URL') || undefined },
    });

    if (error || !data?.properties?.email_otp) {
      this.logger.error(`Failed to generate password reset link for ${email}: ${error?.message || 'missing email_otp'}`);
      const publicClient = this.ensurePublic();
      await publicClient.auth.resetPasswordForEmail(email).catch(() => {});
      return { success: true, message: 'If an account exists, a password reset email has been sent.' };
    }

    const resetCode = data.properties.email_otp as string;
    const hashedToken = data.properties.hashed_token as string | undefined;
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || 'https://clickbit.com.au').replace(/\/$/, '');
    const deepLink = `clickbit://reset-password?token=${hashedToken || ''}&type=recovery`;

    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpPort = Number(this.config.get<number>('SMTP_PORT') || 465);
    const smtpSecure = this.config.get<string>('SMTP_SECURE') !== 'false';
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');
    const fromEmail = this.config.get<string>('FROM_EMAIL') || smtpUser || 'noreply@clickbit.com.au';

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: { user: smtpUser, pass: smtpPass },
          tls: { rejectUnauthorized: false },
        });

        const html = `
          <p>Hi ${profile.first_name || ''},</p>
          <p>You requested a password reset for your ClickBIT account.</p>
          <p style="font-size:24px; font-weight:bold;">Reset code: ${resetCode}</p>
          <p>Enter this code in the ClickBIT app to set a new password. This code expires in 1 hour.</p>
          <p>Alternatively, tap this link on your mobile device to reset automatically:<br/><a href="${deepLink}">${deepLink}</a></p>
          <p>If you did not request this, you can safely ignore this email.</p>
        `;

        await transporter.sendMail({
          from: `ClickBIT <${fromEmail}>`,
          to: email,
          subject: 'ClickBIT password reset',
          text: `Your ClickBIT password reset code is ${resetCode}. Enter it in the app to set a new password. This code expires in 1 hour.`,
          html,
        });

        return { success: true, message: 'If an account exists, a password reset email has been sent.' };
      } catch (e: any) {
        this.logger.error(`Failed to send password reset email to ${email}: ${e.message}`);
      }
    }

    // If SMTP is not configured or sending failed, fall back to Supabase's email service.
    const publicClient = this.ensurePublic();
    await publicClient.auth.resetPasswordForEmail(email, {
      redirectTo: dto.redirect_to || this.config.get<string>('FRONTEND_URL') || undefined,
    }).catch(() => {});
    return { success: true, message: 'If an account exists, a password reset email has been sent.' };
  }

  async resetPassword(dto: { password: string }) {
    if (!dto.password || dto.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    const publicClient = this.ensurePublic();
    const { data, error } = await publicClient.auth.updateUser({ password: dto.password });
    if (error) throw new BadRequestException(error.message);
    return { success: true, message: 'Password updated successfully', user: data.user };
  }

  async resetPasswordWithCode(dto: { code?: string; token_hash?: string; email?: string; password: string }) {
    if (!dto.password || dto.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    if (!dto.code && !dto.token_hash) throw new BadRequestException('Reset code or token is required');

    const publicClient = this.ensurePublic();
    const verifyParams: any = { type: 'recovery' };
    if (dto.code && dto.email) {
      verifyParams.email = dto.email.trim().toLowerCase();
      verifyParams.token = dto.code.trim();
    } else if (dto.token_hash) {
      verifyParams.token_hash = dto.token_hash;
    } else {
      throw new BadRequestException('Email and code are required');
    }

    const { data, error } = await publicClient.auth.verifyOtp(verifyParams);
    if (error || !data.session || !data.user) throw new BadRequestException(error?.message || 'Invalid or expired reset code');

    const admin = this.ensureAdmin();
    const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, { password: dto.password });
    if (updateError) throw new BadRequestException(updateError.message || 'Failed to update password');

    await this.prisma.profiles.updateMany({
      where: { auth_uid: data.user.id },
      data: { password: dto.password, updated_at: new Date() },
    });

    return { success: true, message: 'Password updated successfully' };
  }

  async resendVerification(dto: { email: string }) {
    if (!dto.email) throw new BadRequestException('email is required');
    const publicClient = this.ensurePublic();
    const { error } = await publicClient.auth.resend({ type: 'signup', email: dto.email.trim().toLowerCase() });
    if (error) throw new BadRequestException(error.message);
    return { success: true, message: 'Verification email resent.' };
  }

  async magicLink(dto: { email: string }) {
    await this.invalidateCache();

    if (!dto.email) throw new BadRequestException('email is required');
    const publicClient = this.ensurePublic();
    const { error } = await publicClient.auth.signInWithOtp({ email: dto.email.trim().toLowerCase() });
    if (error) throw new BadRequestException(error.message);
    return { success: true, message: 'Magic link sent.' };
  }

  async deleteAccount(user: any) {
    await this.invalidateCache();

    const admin = this.ensureAdmin();
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (profile?.auth_uid) {
      const { error } = await admin.auth.admin.deleteUser(profile.auth_uid);
      if (error) throw new BadRequestException(error.message);
    }
    await this.prisma.profiles.update({
      where: { id: user.id },
      data: { email: `deleted.user.${user.id}.${Date.now()}@deleted.local`, auth_uid: null, status: 'archived', deleted_at: new Date() } as any,
    });
    return { success: true, message: 'Account deleted successfully' };
  }

  private async getProfileByAuthUid(authUid: string) {
    let profile = await this.prisma.profiles.findFirst({ where: { auth_uid: authUid } });
    if (!profile) {
      const admin = this.ensureAdmin();
      const { data } = await admin.auth.admin.getUserById(authUid);
      if (data.user?.email) {
        profile = await this.prisma.profiles.findFirst({ where: { email: data.user.email.trim().toLowerCase() } });
        if (profile) {
          profile = await this.prisma.profiles.update({ where: { id: profile.id }, data: { auth_uid: authUid } });
        }
      }
    }
    return this.sanitizeProfile(profile);
  }

  private async cleanExpiredTrustedDevices(userId: number) {
    await this.prisma.trusted_devices.deleteMany({
      where: { user_id: userId, expires_at: { lt: new Date() } },
    });
  }

  async trustDevice(user: any, dto: { deviceName?: string; deviceInfo?: string }) {
    await this.cleanExpiredTrustedDevices(user.id);
    const token = randomBytes(32).toString('hex');
    const deviceInfo = dto.deviceName || dto.deviceInfo || 'Unknown device';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const trusted = await this.prisma.trusted_devices.create({
      data: {
        user_id: user.id,
        token,
        device_info: deviceInfo,
        expires_at: expiresAt,
      },
    });
    return { success: true, data: { id: trusted.id, token: trusted.token, expiresAt: trusted.expires_at } };
  }

  async checkTrust(user: any, dto: { token: string }) {
    await this.invalidateCache();

    if (!dto.token) throw new BadRequestException('Trust token is required');
    await this.cleanExpiredTrustedDevices(user.id);
    const trusted = await this.prisma.trusted_devices.findFirst({
      where: { user_id: user.id, token: dto.token, expires_at: { gte: new Date() } },
    });
    if (!trusted) return { success: true, data: { valid: false } };
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.trusted_devices.update({ where: { id: trusted.id }, data: { expires_at: expiresAt } });
    return { success: true, data: { valid: true, id: trusted.id, expiresAt } };
  }

  async trustedDevices(user: any) {
    await this.invalidateCache();

    await this.cleanExpiredTrustedDevices(user.id);
    const devices = await this.prisma.trusted_devices.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: { devices } };
  }

  async removeTrustedDevice(user: any, id: string) {
    await this.invalidateCache();

    const parsedId = Number(id);
    if (!parsedId) throw new BadRequestException('Invalid device id');
    const result = await this.prisma.trusted_devices.deleteMany({ where: { id: parsedId, user_id: user.id } });
    if (result.count === 0) throw new NotFoundException('Device not found');
    return { success: true, message: 'Device removed' };
  }

  async oauthCallback(body: any) {
    const publicClient = this.ensurePublic();
    if (body.code) {
      const { data, error } = await (publicClient.auth as any).exchangeCodeForSession(body.code);
      if (error || !data?.session) throw new BadRequestException(error?.message || 'OAuth code exchange failed');
      const user = await this.getOrCreateProfile(data.user);
      return {
        success: true,
        data: {
          user,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
        },
      };
    }
    if (body.id_token && body.provider) {
      const { data, error } = await (publicClient.auth as any).signInWithIdToken({
        provider: body.provider,
        token: body.id_token,
        nonce: body.nonce,
      });
      if (error || !data?.session) throw new BadRequestException(error?.message || 'OAuth token sign-in failed');
      const user = await this.getOrCreateProfile(data.user);
      return {
        success: true,
        data: {
          user,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
        },
      };
    }
    throw new BadRequestException('code or id_token + provider is required');
  }

  async authCallback(query: any) {
    if (query.error) {
      throw new BadRequestException(`${query.error}: ${query.error_description || ''}`);
    }
    return this.oauthCallback({ code: query.code, provider: query.provider });
  }

  private async getOrCreateProfile(supabaseUser: any) {
    if (!supabaseUser?.id) throw new BadRequestException('No user returned from OAuth provider');
    let profile = await this.prisma.profiles.findFirst({ where: { auth_uid: supabaseUser.id } });
    if (profile) return profile;

    const email = supabaseUser.email?.trim().toLowerCase();
    const metadata = supabaseUser.user_metadata || {};
    const fullName = metadata.full_name || metadata.name || '';
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = metadata.first_name || parts[0] || 'User';
    const lastName = metadata.last_name || parts.slice(1).join(' ') || '';

    if (email) {
      profile = await this.prisma.profiles.findFirst({ where: { email } });
      if (profile) {
        profile = await this.prisma.profiles.update({ where: { id: profile.id }, data: { auth_uid: supabaseUser.id } });
        return this.sanitizeProfile(profile);
      }
    }

    profile = await this.prisma.profiles.create({
      data: {
        email: email || `oauth.${supabaseUser.id}@placeholder.local`,
        auth_uid: supabaseUser.id,
        first_name: firstName,
        last_name: lastName,
        role: 'customer',
        status: 'active',
        email_verified: !!supabaseUser.email_confirmed_at,
      } as any,
    });
    return this.sanitizeProfile(profile);
  }

  async linkedAccounts(user: any) {
    return this.cached(this.cacheKey('linkedAccounts', user.id), async () => {

      const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
      if (!profile) throw new NotFoundException('Profile not found');
      const linked = (Array.isArray(profile.linked_providers) ? profile.linked_providers : []) as any[];
      return {
        success: true,
        data: {
          email: profile.email,
          primary_provider: linked[0]?.provider || 'email',
          linked_accounts: linked,
          supabase_uid: profile.auth_uid ? `***${profile.auth_uid.slice(-8)}` : null,
        },
      };


    });
}

  async linkProvider(user: any, dto: { provider: string; provider_id?: string; provider_email?: string; access_token?: string }) {
    await this.invalidateCache();

    const { provider, provider_id: explicitProviderId } = dto;
    if (!provider) throw new BadRequestException('provider is required');
    const valid = ['google', 'apple', 'github'];
    if (!valid.includes(provider)) throw new BadRequestException(`Invalid provider. Must be one of: ${valid.join(', ')}`);

    let providerId = explicitProviderId;
    let providerEmail = dto.provider_email;

    if (!providerId && dto.access_token) {
      const publicClient = this.ensurePublic();
      const { data: userData, error } = await (publicClient.auth as any).getUser(dto.access_token);
      if (error || !userData?.user) throw new BadRequestException(error?.message || 'Invalid access token');
      const identity = (userData.user.identities || []).find((i: any) => i.provider === provider);
      if (!identity) throw new BadRequestException(`No ${provider} identity found for this user`);
      providerId = identity.identity_data?.sub || identity.id || identity.user_id;
      providerEmail = providerEmail || identity.identity_data?.email || userData.user.email || null;
    }

    if (!providerId) throw new BadRequestException('provider_id is required');

    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');

    const existing = await this.prisma.profiles.findFirst({
      where: {
        NOT: { id: user.id },
        linked_providers: { path: ['$'], equals: [{ provider, provider_id: providerId }] },
      },
    });
    if (existing) throw new BadRequestException(`This ${provider} account is already linked to another user`);

    const linked = Array.isArray(profile.linked_providers) ? (profile.linked_providers as any[]) : [];
    const idx = linked.findIndex((p) => p.provider === provider);
    const entry = { provider, provider_id: providerId, provider_email: providerEmail || null, linked_at: new Date().toISOString() };
    if (idx >= 0) linked[idx] = entry;
    else linked.push(entry);

    const updated = await this.prisma.profiles.update({
      where: { id: user.id },
      data: { linked_providers: linked as any },
    });
    return { success: true, message: `${provider} account linked successfully`, data: { linked_accounts: updated.linked_providers } };
  }

  async unlinkProvider(user: any, provider: string) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');
    const linked = Array.isArray(profile.linked_providers) ? (profile.linked_providers as any[]) : [];
    const remaining = linked.filter((p) => p.provider !== provider);
    if (remaining.length === linked.length) throw new BadRequestException(`${provider} is not linked to this account`);
    if (remaining.length === 0 && !profile.password && !profile.email_verified) {
      throw new BadRequestException('Cannot unlink the last login method. Please set a password or verify your email first.');
    }
    const updated = await this.prisma.profiles.update({
      where: { id: user.id },
      data: { linked_providers: remaining as any },
    });
    return { success: true, message: `${provider} account unlinked successfully`, data: { linked_accounts: updated.linked_providers } };
  }

  async socialLogin(dto: { access_token?: string; refresh_token?: string; provider?: string; provider_id?: string }) {
    await this.invalidateCache();

    if (!dto.access_token) throw new BadRequestException('access_token is required');
    const publicClient = this.ensurePublic();
    const { data, error } = await publicClient.auth.getUser(dto.access_token);
    if (error || !data.user) throw new BadRequestException(error?.message || 'Invalid access token');
    const profile = await this.getOrCreateProfile(data.user);
    return {
      success: true,
      message: 'Login successful',
      data: {
        user: profile,
        accessToken: dto.access_token,
        refreshToken: dto.refresh_token || null,
        isNewUser: !profile.password,
      },
    };
  }

  async verifyEmail(dto: { token?: string; type?: string }) {
    await this.invalidateCache();

    if (!dto.token) throw new BadRequestException('token is required');
    const publicClient = this.ensurePublic();
    const type = (dto.type as any) || 'email';
    const { data, error } = await (publicClient.auth as any).verifyOtp({ token_hash: dto.token, type });
    if (error) throw new BadRequestException(error.message);
    const user = data?.user;
    if (user?.id) {
      const profile = await this.prisma.profiles.findFirst({ where: { auth_uid: user.id } });
      if (profile) {
        await this.prisma.profiles.update({ where: { id: profile.id }, data: { email_verified: true } });
      }
    }
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || 'https://clickbit.com.au').replace(/\/$/, '');
    return { success: true, verified: true, redirectUrl: `${frontendUrl}/login?verified=true` };
  }

  async listMfaFactors(user: any) {
    return this.cached(this.cacheKey('listMfaFactors', user.id), async () => {

      if (!user?.auth_uid) return { success: true, data: { factors: [] } };
      try {
        const rows = await this.prisma.$queryRaw(Prisma.sql`
          SELECT id, friendly_name, factor_type, status
          FROM auth.mfa_factors
          WHERE user_id = ${user.auth_uid}::uuid
        `);
        return { success: true, data: { factors: Array.isArray(rows) ? rows : [] } };
      } catch (err: any) {
        throw new InternalServerErrorException(err?.message || 'Failed to load MFA factors');
      }


    });
  }

  private hashBackupCode(code: string) {
    return createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
  }

  async generateBackupCodes(user: any, count = 10) {
    await this.invalidateCache();
    if (!user?.id) throw new BadRequestException('user required');
    const userId = Number(user.id);
    await this.prisma.user_backup_codes.deleteMany({ where: { user_id: userId } });

    const codes: string[] = [];
    const rows: { user_id: number; code_hash: string; created_at: Date; updated_at: Date }[] = [];
    const now = new Date();
    while (codes.length < count) {
      const raw = randomBytes(6).toString('hex');
      const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
      const hash = this.hashBackupCode(code);
      if (rows.some((r) => r.code_hash === hash)) continue;
      rows.push({ user_id: userId, code_hash: hash, created_at: now, updated_at: now });
      codes.push(code);
    }

    // Insert one-by-one so missing/duplicate DB constraints do not crash the whole batch.
    for (const row of rows) {
      try {
        await this.prisma.user_backup_codes.create({ data: row });
      } catch (err: any) {
        if (err?.code !== 'P2002') {
          this.logger.error(`Failed to insert backup code: ${err?.message}`);
          throw err;
        }
      }
    }
    return { success: true, data: { codes, count: codes.length } };
  }

  async listBackupCodes(user: any) {
    if (!user?.id) throw new BadRequestException('user required');
    const rows = await this.prisma.user_backup_codes.findMany({
      where: { user_id: Number(user.id) },
      orderBy: { created_at: 'desc' as const },
      select: { id: true, used_at: true, created_at: true, updated_at: true },
    });
    return { success: true, data: rows };
  }

  async verifyBackupCode(user: any, code: string) {
    if (!user?.id || !code) throw new BadRequestException('user and code required');
    const hash = this.hashBackupCode(code);
    const row = await this.prisma.user_backup_codes.findFirst({
      where: { user_id: Number(user.id), code_hash: hash },
    });
    if (!row) throw new BadRequestException('Invalid backup code');
    if (row.used_at) throw new BadRequestException('Backup code already used');
    await this.prisma.user_backup_codes.update({ where: { id: row.id }, data: { used_at: new Date() } });
    return { success: true, data: { verified: true } };
  }
}
