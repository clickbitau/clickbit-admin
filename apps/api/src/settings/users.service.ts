import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { stringValue } from './settings-utils';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private getSupabaseAdmin() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return null;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }

  async findAll(query: Record<string, unknown>, user: Profile) {
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

    const [total, data] = await this.prisma.$transaction([
      this.prisma.profiles.count({ where }),
      this.prisma.profiles.findMany({ where, select: { id: true, first_name: true, last_name: true, email: true, role: true, status: true, avatar: true, created_at: true, auth_uid: true, email_verified: true }, orderBy, skip: offset, take: limit }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findTeam() {
    return this.prisma.profiles.findMany({
      where: { role: { in: ['admin', 'manager'] }, status: 'active', deleted_at: null },
      select: { id: true, first_name: true, last_name: true, email: true, role: true, avatar: true },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    });
  }

  async findManagers() {
    const managers = await this.prisma.profiles.findMany({
      where: { role: 'manager', deleted_at: null },
      select: { id: true, first_name: true, last_name: true, email: true, status: true, permissions: true, created_at: true, last_login: true },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    });
    return managers.map((m: any) => ({ ...m, permissions: m.permissions || [], usingDefaultPermissions: !m.permissions || (Array.isArray(m.permissions) && m.permissions.length === 0) }));
  }

  async findById(id: number, actor: Profile) {
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user || user.deleted_at) throw new NotFoundException({ message: 'Profile not found' });
    if (actor.role === 'manager' && user.role !== 'customer') throw new ForbiddenException({ message: 'Managers can only view customer accounts.' });
    return user;
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
    return { message: 'Profile deleted successfully' };
  }
}
