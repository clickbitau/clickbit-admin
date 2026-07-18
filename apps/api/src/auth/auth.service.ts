import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private adminClient: SupabaseClient | null = null;
  private publicClient: SupabaseClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
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
    const { password: _password, email_verification_token: _emailVerificationToken, password_reset_token: _passwordResetToken, ...safe } = profile;
    return safe;
  }

  async register(dto: { email: string; password: string; first_name: string; last_name: string; phone?: string }) {
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

  async login(dto: { email: string; password: string }) {
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
    const publicClient = this.ensurePublic();
    await publicClient.auth.signOut();
    return { success: true, message: 'Logged out successfully' };
  }

  async me(user: any) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new BadRequestException('Profile not found');
    return { success: true, data: { user: this.sanitizeProfile(profile) } };
  }

  async refresh(dto: { refreshToken: string }) {
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

  async forgotPassword(dto: { email: string }) {
    if (!dto.email) throw new BadRequestException('email is required');
    const publicClient = this.ensurePublic();
    const { error } = await publicClient.auth.resetPasswordForEmail(dto.email.trim().toLowerCase());
    if (error) throw new BadRequestException(error.message);
    return { success: true, message: 'If an account exists, a password reset email has been sent.' };
  }

  async resetPassword(dto: { password: string }) {
    if (!dto.password || dto.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    const publicClient = this.ensurePublic();
    const { data, error } = await publicClient.auth.updateUser({ password: dto.password });
    if (error) throw new BadRequestException(error.message);
    return { success: true, message: 'Password updated successfully', user: data.user };
  }

  async resendVerification(dto: { email: string }) {
    if (!dto.email) throw new BadRequestException('email is required');
    const publicClient = this.ensurePublic();
    const { error } = await publicClient.auth.resend({ type: 'signup', email: dto.email.trim().toLowerCase() });
    if (error) throw new BadRequestException(error.message);
    return { success: true, message: 'Verification email resent.' };
  }

  async magicLink(dto: { email: string }) {
    if (!dto.email) throw new BadRequestException('email is required');
    const publicClient = this.ensurePublic();
    const { error } = await publicClient.auth.signInWithOtp({ email: dto.email.trim().toLowerCase() });
    if (error) throw new BadRequestException(error.message);
    return { success: true, message: 'Magic link sent.' };
  }

  async deleteAccount(user: any) {
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
    await this.cleanExpiredTrustedDevices(user.id);
    const devices = await this.prisma.trusted_devices.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: { devices } };
  }

  async removeTrustedDevice(user: any, id: string) {
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
  }

  async linkProvider(user: any, dto: { provider: string; provider_id: string; provider_email?: string }) {
    const { provider, provider_id } = dto;
    if (!provider || !provider_id) throw new BadRequestException('provider and provider_id are required');
    const valid = ['google', 'facebook', 'apple', 'github'];
    if (!valid.includes(provider)) throw new BadRequestException(`Invalid provider. Must be one of: ${valid.join(', ')}`);

    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');

    const existing = await this.prisma.profiles.findFirst({
      where: {
        NOT: { id: user.id },
        linked_providers: { path: ['$'], equals: [{ provider, provider_id }] },
      },
    });
    if (existing) throw new BadRequestException(`This ${provider} account is already linked to another user`);

    const linked = Array.isArray(profile.linked_providers) ? (profile.linked_providers as any[]) : [];
    const idx = linked.findIndex((p) => p.provider === provider);
    const entry = { provider, provider_id, provider_email: dto.provider_email || null, linked_at: new Date().toISOString() };
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
}
