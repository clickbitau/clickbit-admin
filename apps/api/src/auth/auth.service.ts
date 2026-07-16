import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

  async logout(_user: any) {
    const publicClient = this.ensurePublic();
    await publicClient.auth.signOut();
    return { success: true, message: 'Logged out successfully' };
  }

  async me(user: any) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new BadRequestException('Profile not found');
    return { success: true, data: { user: profile } };
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
    return profile;
  }

  trustedDevices() { return { devices: [] }; }
  trustDevice(_body: any) { return { success: true, message: 'Trusted device saved' }; }
  checkTrust(_body: any) { return { trusted: false }; }
  removeTrustedDevice(_id: string) { return { success: true, message: 'Device removed' }; }
  oauthCallback(_body: any) { throw new BadRequestException('OAuth callback not implemented in this pass'); }
  authCallback(_query: any) { throw new BadRequestException('Auth callback not implemented in this pass'); }
}
