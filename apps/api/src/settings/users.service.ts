import { BadRequestException, ForbiddenException, Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Profile } from '@clickbit/shared';
import { stringValue } from './settings-utils';
import { CacheService } from '../redis/cache.service';

const DEFAULT_MANAGER_PERMISSIONS = [
  'content:list', 'content:view', 'content:create', 'content:update', 'content:delete',
  'services:list', 'services:view', 'services:create', 'services:update', 'services:delete',
  'team:list', 'team:view', 'team:create', 'team:update', 'team:delete',
  'reviews:list', 'reviews:view', 'reviews:update', 'reviews:delete',
  'contacts:list', 'contacts:view', 'contacts:delete',
  'orders:list', 'orders:view', 'orders:update', 'orders:delete',
  'dashboard:view', 'settings:view', 'settings:update', 'marketing:view', 'marketing:update',
  'tasks:list_assignees', 'tasks:mention_colleagues',
];

const AVAILABLE_PERMISSIONS: Record<string, { key: string; label: string; description: string }[]> = {
  dashboard: [{ key: 'dashboard:view', label: 'View Dashboard', description: 'Access the admin dashboard' }],
  users: [
    { key: 'users:list', label: 'List Users', description: 'View list of users' },
    { key: 'users:view', label: 'View Profile Details', description: 'View individual user details' },
    { key: 'users:create', label: 'Create Users', description: 'Create new user accounts' },
    { key: 'users:update', label: 'Update Users', description: 'Modify user accounts' },
    { key: 'users:delete', label: 'Delete Users', description: 'Remove user accounts' },
  ],
  content: [
    { key: 'content:list', label: 'List Content', description: 'View list of blog posts and portfolio items' },
    { key: 'content:view', label: 'View Content', description: 'View individual content items' },
    { key: 'content:create', label: 'Create Content', description: 'Create new blog posts and portfolio items' },
    { key: 'content:update', label: 'Update Content', description: 'Modify existing content' },
    { key: 'content:delete', label: 'Delete Content', description: 'Remove content items' },
  ],
  services: [
    { key: 'services:list', label: 'List Services', description: 'View list of services' },
    { key: 'services:view', label: 'View Services', description: 'View service details' },
    { key: 'services:create', label: 'Create Services', description: 'Create new services' },
    { key: 'services:update', label: 'Update Services', description: 'Modify services' },
    { key: 'services:delete', label: 'Delete Services', description: 'Remove services' },
  ],
  team: [
    { key: 'team:list', label: 'List Team Members', description: 'View team member list' },
    { key: 'team:view', label: 'View Team Members', description: 'View team member details' },
    { key: 'team:create', label: 'Create Team Members', description: 'Add new team members' },
    { key: 'team:update', label: 'Update Team Members', description: 'Modify team member info' },
    { key: 'team:delete', label: 'Delete Team Members', description: 'Remove team members' },
  ],
  reviews: [
    { key: 'reviews:list', label: 'List Reviews', description: 'View list of reviews' },
    { key: 'reviews:view', label: 'View Reviews', description: 'View review details' },
    { key: 'reviews:update', label: 'Update Reviews', description: 'Modify reviews (approve/reject)' },
    { key: 'reviews:delete', label: 'Delete Reviews', description: 'Remove reviews' },
  ],
  contacts: [
    { key: 'contacts:list', label: 'List Contacts', description: 'View list of contacts' },
    { key: 'contacts:view', label: 'View Contacts', description: 'View contact details' },
    { key: 'contacts:delete', label: 'Delete Contacts', description: 'Remove contacts' },
  ],
  orders: [
    { key: 'orders:list', label: 'List Orders', description: 'View list of orders' },
    { key: 'orders:view', label: 'View Orders', description: 'View order details' },
    { key: 'orders:update', label: 'Update Orders', description: 'Modify order status' },
    { key: 'orders:delete', label: 'Delete Orders', description: 'Remove orders' },
  ],
  settings: [
    { key: 'settings:view', label: 'View Settings', description: 'View site settings' },
    { key: 'settings:update', label: 'Update Settings', description: 'Modify site settings' },
  ],
  billing: [
    { key: 'billing:view', label: 'View Billing', description: 'View billing settings' },
    { key: 'billing:update', label: 'Update Billing', description: 'Modify billing settings' },
  ],
  marketing: [
    { key: 'marketing:view', label: 'View Marketing', description: 'View marketing settings' },
    { key: 'marketing:update', label: 'Update Marketing', description: 'Modify marketing settings' },
  ],
  crm: [
    { key: 'crm:view', label: 'View CRM', description: 'Access CRM features' },
    { key: 'crm:manage', label: 'Manage CRM', description: 'Create/Edit CRM data' },
  ],
  hr: [
    { key: 'hr:view', label: 'View HR', description: 'Access HR features' },
    { key: 'hr:manage', label: 'Manage HR', description: 'Create/Edit HR data (timesheets, schedules, etc.)' },
    { key: 'contracts:manage', label: 'Manage Contracts', description: 'Create, edit, activate, terminate and email employment contracts' },
  ],
  finance: [
    { key: 'finance:view', label: 'View Finance', description: 'Access invoices and expenses' },
    { key: 'finance:manage', label: 'Manage Finance', description: 'Create/Edit invoices and expenses' },
  ],
  tasks: [
    { key: 'tasks:list_assignees', label: 'List task assignees & mentions', description: 'Load the staff list for task assignee dropdowns and @mentions' },
    { key: 'tasks:mention_colleagues', label: 'Mention colleagues on tasks', description: 'Load teammates for @mentions in Tasks → Activity and post comments that notify mentioned users' },
  ],
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('users', ...parts) ?? `users:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  private getSupabaseAdmin() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return null;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }

  async findAll(query: Record<string, unknown>, user: Profile) {
    return this.cached(this.cacheKey('list', user.id, user.role, JSON.stringify(query)), async () => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 50);
    const offset = (page - 1) * limit;
    const search = stringValue(query.search);
    const status = stringValue(query.status);
    const sortBy = stringValue(query.sortBy, 'name');
    const sortOrder = stringValue(query.sortOrder, 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';

    const where: any = { deleted_at: null };
    if (user.role === 'manager') where.role = 'customer';
    else if (query.roles) where.role = { in: stringValue(query.roles).split(',') };
    if (status) where.status = status;
    if (search) where.OR = [{ first_name: { contains: search, mode: 'insensitive' } }, { last_name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }];

    let orderBy: any = [{ first_name: sortOrder }, { last_name: sortOrder }];
    if (sortBy === 'email') orderBy = [{ email: sortOrder }];
    if (sortBy === 'status') orderBy = [{ status: sortOrder }];
    if (sortBy === 'created_at') orderBy = [{ created_at: sortOrder }];
    if (sortBy === 'last_login') orderBy = [{ last_login: sortOrder }];

    const [total, data] = await this.prisma.$transaction([
      this.prisma.profiles.count({ where }),
      this.prisma.profiles.findMany({ where, select: { id: true, first_name: true, last_name: true, email: true, role: true, status: true, avatar: true, created_at: true, auth_uid: true, email_verified: true, last_login: true, locked_until: true, login_attempts: true }, orderBy, skip: offset, take: limit }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    });
  }

  async findTeam() {
    return this.cached(this.cacheKey('team'), async () => this.prisma.profiles.findMany({
      where: { role: { in: ['admin', 'manager'] }, status: 'active', deleted_at: null },
      select: { id: true, first_name: true, last_name: true, email: true, role: true, avatar: true },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    }));
  }

  async findManagers() {
    return this.cached(this.cacheKey('managers'), async () => {
    const managers = await this.prisma.profiles.findMany({
      where: { role: 'manager', deleted_at: null },
      select: { id: true, first_name: true, last_name: true, email: true, status: true, permissions: true, created_at: true, last_login: true },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    });
    return managers.map((m: any) => ({ ...m, permissions: m.permissions || [], usingDefaultPermissions: !m.permissions || (Array.isArray(m.permissions) && m.permissions.length === 0) }));
    });
  }

  async findById(id: number, actor: Profile) {
    return this.cached(this.cacheKey('detail', actor.id, id), async () => {
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user || user.deleted_at) throw new NotFoundException({ message: 'Profile not found' });
    if (actor.role === 'manager' && user.role !== 'customer') throw new ForbiddenException({ message: 'Managers can only view customer accounts.' });
    return user;
    });
  }

  async create(dto: Record<string, unknown>, actor: Profile) {
    const firstName = stringValue(dto.first_name);
    const lastName = stringValue(dto.last_name);
    const email = stringValue(dto.email).trim().toLowerCase();
    const password = stringValue(dto.password);
    const role = stringValue(dto.role);
    if (!firstName || !lastName || !email || !password || !role) throw new BadRequestException({ message: 'Please provide all required fields.' });
    if (actor.role === 'manager' && role !== 'customer') throw new ForbiddenException({ message: 'Managers can only create customer accounts.' });

    const admin = this.getSupabaseAdmin();
    let auth_uid: string | null = null;
    if (admin) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: actor.role === 'admin' ? (dto.email_verified !== false) : false, user_metadata: { first_name: firstName, last_name: lastName } });
      if (error) throw new BadRequestException({ message: 'Failed to create user in Supabase Auth. ' + error.message });
      auth_uid = data.user?.id || null;
    }

    const user = await this.prisma.profiles.create({
      data: {
        first_name: firstName, last_name: lastName, email, phone: stringValue(dto.phone) || null,
        role, password: null, auth_uid, email_verified: actor.role === 'admin' ? (dto.email_verified !== false) : false,
        avatar: stringValue(dto.avatar) || null, job_title: stringValue(dto.job_title) || null,
        company: stringValue(dto.company) || null, bio: stringValue(dto.bio) || null,
        website: stringValue(dto.website) || null, timezone: stringValue(dto.timezone) || 'Australia/Perth',
        language: stringValue(dto.language) || 'en', address: stringValue(dto.address) || null,
        status: 'active', created_at: new Date(), updated_at: new Date(),
      },
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', actor.id, user.id));
    return user;
  }

  async update(id: number, dto: Record<string, unknown>, actor: Profile) {
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user || user.deleted_at) throw new NotFoundException({ message: 'Profile not found' });
    if (actor.role === 'manager' && user.role !== 'customer') throw new ForbiddenException({ message: 'Managers can only update customer accounts.' });

    const role = dto.role !== undefined ? stringValue(dto.role) : undefined;
    if (role && role !== user.role && actor.role !== 'admin') throw new ForbiddenException({ message: 'Only administrators can change user roles.', error: 'ROLE_CHANGE_FORBIDDEN' });

    const data: any = {};
    if (dto.first_name !== undefined) data.first_name = stringValue(dto.first_name);
    if (dto.last_name !== undefined) data.last_name = stringValue(dto.last_name);
    if (dto.email !== undefined) data.email = stringValue(dto.email).trim().toLowerCase();
    if (dto.phone !== undefined) data.phone = stringValue(dto.phone) || null;
    if (dto.job_title !== undefined) data.job_title = stringValue(dto.job_title) || null;
    if (dto.company !== undefined) {
      if (typeof dto.company === 'string') data.company = stringValue(dto.company) || null;
      else if (dto.company && typeof dto.company === 'object') data.company = stringValue((dto.company as any).name) || null;
      else data.company = null;
    }
    if (dto.bio !== undefined) data.bio = stringValue(dto.bio) || null;
    if (dto.website !== undefined) data.website = stringValue(dto.website) || null;
    if (dto.timezone !== undefined) data.timezone = stringValue(dto.timezone) || null;
    if (dto.language !== undefined) data.language = stringValue(dto.language) || null;
    if (dto.address !== undefined) data.address = stringValue(dto.address) || null;
    if (dto.status !== undefined) data.status = stringValue(dto.status);
    if (actor.role === 'admin') {
      if (role !== undefined) data.role = role;
      if (dto.email_verified !== undefined) data.email_verified = dto.email_verified === true;
    }
    data.updated_at = new Date();

    const admin = this.getSupabaseAdmin();
    if (admin && user.auth_uid) {
      const updates: any = {};
      if (data.email) updates.email = data.email;
      if (dto.password) {
        const pwd = stringValue(dto.password);
        if (pwd.length < 6 || pwd.length > 255) throw new BadRequestException({ message: 'Password must be between 6 and 255 characters' });
        updates.password = pwd;
      }
      if (actor.role === 'admin' && dto.email_verified !== undefined) updates.email_confirm = dto.email_verified === true;
      if (data.status === 'archived' && user.status !== 'archived') await admin.auth.admin.updateUserById(user.auth_uid, { ban_duration: '1000000h' });
      if (user.status === 'archived' && data.status !== 'archived') await admin.auth.admin.updateUserById(user.auth_uid, { ban_duration: '0s' });
      if (Object.keys(updates).length) {
        const { error } = await admin.auth.admin.updateUserById(user.auth_uid, updates);
        if (error) throw new BadRequestException({ message: 'Failed to update user in Supabase Auth: ' + error.message });
      }
    } else if (dto.password) {
      data.password = stringValue(dto.password);
    }

    if (data.email) {
      const existing = await this.prisma.profiles.findFirst({ where: { email: data.email, NOT: { id } } });
      if (existing) throw new BadRequestException({ message: 'Email already in use' });
    }

    const updated = await this.prisma.profiles.update({ where: { id }, data });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', actor.id, id));
    return updated;
  }

  async remove(id: number, actor: Profile) {
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user || user.deleted_at) throw new NotFoundException({ message: 'Profile not found' });
    if (actor.role === 'manager' && user.role !== 'customer') throw new ForbiddenException({ message: 'Managers can only delete customer accounts.' });
    const admin = this.getSupabaseAdmin();
    if (admin && user.auth_uid) {
      const { error } = await admin.auth.admin.deleteUser(user.auth_uid);
      if (error) throw new BadRequestException({ message: 'Failed to delete user from authentication service. ' + error.message });
    }
    await this.prisma.profiles.update({ where: { id }, data: { email: `deleted.user.${user.id}.${Date.now()}@deleted.local`, auth_uid: null, status: 'archived', deleted_at: new Date() } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', actor.id, id));
    return { message: 'Profile deleted successfully' };
  }

  async accountStatus(id: number) {
    return this.cached(this.cacheKey('account-status', id), async () => {
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user || user.deleted_at) throw new NotFoundException({ message: 'Profile not found' });
    const linkedContact = await this.prisma.contacts.findFirst({ where: { user_id: id } });
    return {
      user_id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      has_auth: !!user.auth_uid,
      auth_uid: user.auth_uid || null,
      email_verified: user.email_verified || false,
      created_at: user.created_at,
      last_login: user.last_login || null,
      has_ever_logged_in: !!user.last_login,
      welcome_email: { sent: false, status: null, sent_at: null, failed: false, error: null },
      password_reset_email: { sent: false, sent_at: null },
      linked_contact: linkedContact ? { id: linkedContact.id, name: linkedContact.name, email: linkedContact.email, lifecycle_stage: linkedContact.lifecycle_stage, company: linkedContact.company } : null,
    };
    });
  }

  async resendWelcome(id: number) {
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user || user.deleted_at) throw new NotFoundException({ message: 'Profile not found' });
    const admin = this.getSupabaseAdmin();
    if (admin) {
      if (!user.auth_uid) {
        const { data, error } = await admin.auth.admin.createUser({
          email: user.email,
          password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
          email_confirm: false,
          user_metadata: { first_name: user.first_name, last_name: user.last_name },
        });
        if (error) throw new BadRequestException({ message: error.message });
        await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', user.id));
    await this.prisma.profiles.update({ where: { id: user.id }, data: { auth_uid: data.user?.id } });
      }
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email });
      if (linkError) throw new BadRequestException({ message: linkError.message });
      // Email delivery is a stub; the link would be sent via a real email service.
      return { success: true, message: 'Welcome email dispatched', userId: user.id, link: link?.properties?.action_link || null };
    }
    return { success: true, message: 'Welcome email dispatched (no auth provider configured)' };
  }

  async reset2fa(id: number) {
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user || user.deleted_at) throw new NotFoundException({ message: 'Profile not found' });
    const admin = this.getSupabaseAdmin();
    if (!admin) throw new BadRequestException('Supabase Auth is not configured');
    if (!user.auth_uid) throw new BadRequestException('This user has no linked authentication account.');
    let removed = 0;
    try {
      const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: user.auth_uid });
      if (error) throw error;
      for (const factor of data.factors || []) {
        const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.auth_uid });
        if (!deleteError) removed++;
      }
    } catch (mfaErr: any) {
      throw new BadRequestException({ message: 'Failed to reset two-factor authentication: ' + mfaErr.message });
    }
    return { success: true, message: removed > 0 ? `Two-factor authentication reset for ${user.email}.` : `${user.email} did not have two-factor authentication enabled.`, removedFactors: removed };
  }

  async uploadAvatar(id: number, file: Express.Multer.File, actor: Profile) {
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user || user.deleted_at) throw new NotFoundException({ message: 'Profile not found' });
    if (actor.role === 'manager' && user.role !== 'customer') throw new ForbiddenException({ message: 'Managers can only update customer accounts.' });
    if (!this.storage.isConfigured()) throw new InternalServerErrorException('Storage is not configured');
    if (user.avatar) await this.storage.deleteByUrl(user.avatar, ['avatars']);
    const result = await this.storage.upload(file.buffer, 'avatars', file.originalname, file.mimetype, '', `user-${user.id}-${Date.now()}.webp`);
    if (!result.success) throw new InternalServerErrorException(result.error);
    await this.prisma.profiles.update({ where: { id }, data: { avatar: result.url } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', actor.id, id));
    return { success: true, message: 'Avatar uploaded successfully', data: { avatar: result.url } };
  }

  async deleteAvatar(id: number, actor: Profile) {
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user || user.deleted_at) throw new NotFoundException({ message: 'Profile not found' });
    if (actor.role === 'manager' && user.role !== 'customer') throw new ForbiddenException({ message: 'Managers can only update customer accounts.' });
    if (user.avatar) await this.storage.deleteByUrl(user.avatar, ['avatars']);
    await this.prisma.profiles.update({ where: { id }, data: { avatar: null } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', actor.id, id));
    return { success: true, message: 'Avatar deleted successfully', data: { avatar: null } };
  }

  availablePermissions() {
    return { availablePermissions: AVAILABLE_PERMISSIONS, defaultManagerPermissions: DEFAULT_MANAGER_PERMISSIONS };
  }

  async getPermissions(id: number) {
    return this.cached(this.cacheKey('permissions', id), async () => {
    const user = await this.prisma.profiles.findUnique({ where: { id }, select: { id: true, first_name: true, last_name: true, email: true, role: true, permissions: true } });
    if (!user) throw new NotFoundException({ message: 'Profile not found' });
    if (user.role !== 'manager') throw new BadRequestException({ message: 'Permissions can only be customized for managers. Admins have all permissions by default.' });
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    return { user: { id: user.id, name: `${user.first_name} ${user.last_name}`, email: user.email, role: user.role }, customPermissions: perms, effectivePermissions: perms.length > 0 ? perms : DEFAULT_MANAGER_PERMISSIONS, usingDefaultPermissions: perms.length === 0 };
    });
  }

  async updatePermissions(id: number, permissions: string[]) {
    if (!Array.isArray(permissions)) throw new BadRequestException({ message: 'Permissions must be an array' });
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ message: 'Profile not found' });
    if (user.role !== 'manager') throw new BadRequestException({ message: 'Permissions can only be customized for managers. Admins have all permissions by default.' });
    const updated = await this.prisma.profiles.update({ where: { id }, data: { permissions: permissions.length > 0 ? permissions as any : [] } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('permissions', id));
    return { message: 'Permissions updated successfully', user: { id: updated.id, name: `${updated.first_name} ${updated.last_name}`, email: updated.email }, permissions: permissions.length > 0 ? permissions : DEFAULT_MANAGER_PERMISSIONS, usingDefaultPermissions: permissions.length === 0 };
  }

  async resetPermissions(id: number) {
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ message: 'Profile not found' });
    if (user.role !== 'manager') throw new BadRequestException({ message: 'Permissions can only be reset for managers.' });
    const updated = await this.prisma.profiles.update({ where: { id }, data: { permissions: [] as any } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('permissions', id));
    return { message: 'Permissions reset to defaults', user: { id: updated.id, name: `${updated.first_name} ${updated.last_name}`, email: updated.email }, permissions: DEFAULT_MANAGER_PERMISSIONS };
  }
}
