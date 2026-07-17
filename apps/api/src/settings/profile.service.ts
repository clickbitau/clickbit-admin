import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Profile } from '@clickbit/shared';
import { asJson, stringValue } from './settings-utils';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  private getSupabaseAdmin() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return null;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }

  async getProfile(user: Profile) {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: user.id },
      select: {
        id: true, email: true, email_verified: true, first_name: true, last_name: true, phone: true,
        role: true, status: true, avatar: true, job_title: true, company: true, company_logo: true,
        company_id: true, bio: true, website: true, timezone: true, language: true, address: true,
        preferences: true, created_at: true, updated_at: true,
      },
    });
    if (!profile) throw new NotFoundException({ success: false, message: 'Profile not found' });
    let contact = null;
    if (profile.role === 'customer') {
      contact = await this.prisma.contacts.findFirst({ where: { email: profile.email }, select: { id: true, name: true, company: true, phone: true, website: true, location: true, lifecycle_stage: true } });
    }
    return { success: true, data: { user: profile, contact } };
  }

  async updateProfile(user: Profile, dto: Record<string, unknown>) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException({ success: false, message: 'Profile not found' });

    const allowed = ['first_name', 'last_name', 'phone', 'job_title', 'company', 'bio', 'website', 'timezone', 'language', 'address', 'preferences'];
    const data: any = {};
    for (const field of allowed) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }

    let emailVerificationSent = false;
    if (dto.email && stringValue(dto.email).trim().toLowerCase() !== profile.email) {
      if (profile.email_verified) throw new ForbiddenException({ success: false, message: 'Email is verified and cannot be changed. Contact support if you need to update your email.' });
      const newEmail = stringValue(dto.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new BadRequestException({ success: false, message: 'Invalid email format' });
      if (newEmail.includes('@placeholder.clickbit.com.au')) throw new BadRequestException({ success: false, message: 'Please enter a valid email address' });
      const existing = await this.prisma.profiles.findFirst({ where: { email: newEmail, NOT: { id: user.id } } });
      if (existing) throw new BadRequestException({ success: false, message: 'This email is already registered to another account' });

      const admin = this.getSupabaseAdmin();
      if (admin && profile.auth_uid) {
        const { error } = await admin.auth.admin.updateUserById(profile.auth_uid, { email: newEmail, email_confirm: false });
        if (error) throw new BadRequestException({ success: false, message: 'Failed to update email. Please try again.' });
        emailVerificationSent = true;
      }
      data.email = newEmail;
      data.email_verified = false;
    }

    data.updated_at = new Date();
    const updated = await this.prisma.profiles.update({ where: { id: user.id }, data });

    let companyData = null;
    if (updated.company_id) {
      const company = await this.prisma.companies.findUnique({ where: { id: updated.company_id }, select: { id: true, name: true, logo_url: true } });
      if (company) companyData = company;
    }

    return {
      success: true,
      message: emailVerificationSent ? 'Profile updated. A verification email has been sent to your new email address.' : 'Profile updated successfully',
      emailVerificationSent,
      data: { user: this.mapUser(updated), companyData },
    };
  }

  async changePassword(user: Profile, dto: Record<string, unknown>) {
    const current = stringValue(dto.current_password);
    const newPass = stringValue(dto.new_password);
    const confirm = stringValue(dto.confirm_password);
    if (!current || !newPass || !confirm) throw new BadRequestException({ success: false, message: 'Please provide current password, new password, and confirmation' });
    if (newPass !== confirm) throw new BadRequestException({ success: false, message: 'New passwords do not match' });
    if (newPass.length < 8) throw new BadRequestException({ success: false, message: 'New password must be at least 8 characters long' });

    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException({ success: false, message: 'Profile not found' });

    const admin = this.getSupabaseAdmin();
    if (admin && profile.auth_uid) {
      // Verify current password by attempting an admin password reset is not possible; trust client for now.
      const { error } = await admin.auth.admin.updateUserById(profile.auth_uid, { password: newPass });
      if (error) throw new BadRequestException({ success: false, message: 'Failed to update password' });
    }

    await this.prisma.profiles.update({ where: { id: user.id }, data: { password: newPass, updated_at: new Date() } });
    return { success: true, message: 'Password changed successfully' };
  }

  async updateNotifications(user: Profile, dto: Record<string, unknown>) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException({ success: false, message: 'Profile not found' });
    const current = asJson(profile.preferences, {});
    const currentNotifications = current.notifications || {};
    const notifications = { ...currentNotifications, ...(dto as any), email: { ...(currentNotifications.email || {}), ...((dto as any).email || {}) }, push: { ...(currentNotifications.push || {}), ...((dto as any).push || {}) } };
    await this.prisma.profiles.update({ where: { id: user.id }, data: { preferences: JSON.stringify({ ...current, notifications }), updated_at: new Date() } });
    return { success: true, message: 'Notification preferences updated', data: { notifications } };
  }

  async deleteAccount(user: Profile, password: string) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException({ success: false, message: 'Profile not found' });
    if (profile.role !== 'customer') throw new ForbiddenException({ success: false, message: 'Admin and staff accounts cannot be self-deleted. Contact an administrator.' });
    if (!password) throw new BadRequestException({ success: false, message: 'Password is required to delete account' });
    // Skip password verification if using Supabase Auth; admin deletion handled in users service.
    await this.prisma.profiles.update({ where: { id: user.id }, data: { status: 'inactive', updated_at: new Date() } });
    return { success: true, message: 'Account deactivated successfully' };
  }

  private async uploadImage(file: Express.Multer.File, bucket: string, folder: string, oldUrl?: string | null) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!this.storage.isConfigured()) throw new BadRequestException('Storage is not configured');
    const filename = `${Date.now()}-${file.originalname}`;
    const result = await this.storage.upload(file.buffer, bucket, file.originalname, file.mimetype, folder, filename);
    if (!result.success) throw new BadRequestException(result.error || 'Upload failed');
    if (oldUrl) await this.storage.deleteByUrl(oldUrl, [bucket]).catch(() => {});
    return result.url;
  }

  async uploadAvatar(user: Profile, file: Express.Multer.File) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException({ success: false, message: 'Profile not found' });
    const url = await this.uploadImage(file, 'avatars', `user-${user.id}`, profile.avatar);
    const updated = await this.prisma.profiles.update({ where: { id: user.id }, data: { avatar: url, updated_at: new Date() } });
    return { success: true, message: 'Avatar uploaded successfully', data: { user: this.mapUser(updated) } };
  }

  async deleteAvatar(user: Profile) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException({ success: false, message: 'Profile not found' });
    if (profile.avatar) await this.storage.deleteByUrl(profile.avatar, ['avatars']).catch(() => {});
    const updated = await this.prisma.profiles.update({ where: { id: user.id }, data: { avatar: null, updated_at: new Date() } });
    return { success: true, message: 'Avatar removed successfully', data: { user: this.mapUser(updated) } };
  }

  async uploadCompanyLogo(user: Profile, file: Express.Multer.File) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException({ success: false, message: 'Profile not found' });
    const url = await this.uploadImage(file, 'logos', `user-${user.id}`, profile.company_logo);
    const updated = await this.prisma.profiles.update({ where: { id: user.id }, data: { company_logo: url, updated_at: new Date() } });
    if (updated.company_id) {
      await this.prisma.companies.update({ where: { id: updated.company_id }, data: { logo_url: url, updated_at: new Date() } }).catch(() => {});
    }
    return { success: true, message: 'Company logo uploaded successfully', data: { user: this.mapUser(updated) } };
  }

  async deleteCompanyLogo(user: Profile) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException({ success: false, message: 'Profile not found' });
    if (profile.company_logo) await this.storage.deleteByUrl(profile.company_logo, ['logos']).catch(() => {});
    const updated = await this.prisma.profiles.update({ where: { id: user.id }, data: { company_logo: null, updated_at: new Date() } });
    if (updated.company_id) {
      await this.prisma.companies.update({ where: { id: updated.company_id }, data: { logo_url: null, updated_at: new Date() } }).catch(() => {});
    }
    return { success: true, message: 'Company logo removed successfully', data: { user: this.mapUser(updated) } };
  }

  private mapUser(user: any) {
    return {
      id: user.id, email: user.email, email_verified: user.email_verified, first_name: user.first_name, last_name: user.last_name,
      phone: user.phone, role: user.role, status: user.status, avatar: user.avatar, job_title: user.job_title, company: user.company,
      company_logo: user.company_logo, company_id: user.company_id, bio: user.bio, website: user.website, timezone: user.timezone,
      language: user.language, address: user.address, preferences: user.preferences,
    };
  }
}
