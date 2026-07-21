import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { asJsonInput, buildLegacyDataEnvelope, buildLegacyListEnvelope, buildLegacyMessageEnvelope } from './hr-utils';
import { CacheService } from '../redis/cache.service';

const authorSelect = { select: { id: true, first_name: true, last_name: true, avatar: true } } as const;

const announcementInclude = {
  profiles: authorSelect,
} as const;

function mapAnnouncement(announcement: Prisma.hr_announcementsGetPayload<{ include: typeof announcementInclude }>) {
  const a = announcement as unknown as Record<string, unknown>;
  return {
    ...a,
    author: a.profiles,
    profiles: undefined,
  };
}

function parseDateOnly(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('announcements', ...parts) ?? `announcements:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  private isAdminOrManager(user: Profile) {
    return user.role === 'admin' || user.role === 'manager';
  }

  async findPublic(query: { page?: number; limit?: number }) {
    return this.cached(this.cacheKey('public', JSON.stringify(query)), async () => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.hr_announcementsWhereInput = {
      status: 'published',
      visible_to_guests: true,
      OR: [{ expires_at: null }, { expires_at: { gt: now } }],
    };

    const [total, rows] = await Promise.all([
      this.prisma.hr_announcements.count({ where }),
      this.prisma.hr_announcements.findMany({
        where,
        include: announcementInclude,
        orderBy: [{ is_pinned: 'desc' }, { pin_order: 'asc' }, { publish_at: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return buildLegacyListEnvelope(rows.map(mapAnnouncement), total, page, limit);
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }, user: Profile) {
    return this.cached(this.cacheKey('list', user.id, JSON.stringify(query)), async () => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.hr_announcementsWhereInput = {};
    if (query.status) where.status = query.status as any;
    if (query.type) where.type = query.type as any;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
        { content_html: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (!this.isAdminOrManager(user)) {
      where.status = 'published';
      where.OR = [{ expires_at: null }, { expires_at: { gt: new Date() } }];
    }

    const orderBy: Prisma.hr_announcementsOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'created_at';
    const sortDir = query.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    (orderBy as any)[sortField] = sortDir;

    const [total, rows] = await Promise.all([
      this.prisma.hr_announcements.count({ where }),
      this.prisma.hr_announcements.findMany({ where, include: announcementInclude, orderBy, skip, take: limit }),
    ]);

    return buildLegacyListEnvelope(rows.map(mapAnnouncement), total, page, limit);
    });
  }

  async findOne(id: number) {
    return this.cached(this.cacheKey('detail', id), async () => {
    const announcement = await this.prisma.hr_announcements.findUnique({ where: { id }, include: announcementInclude });
    if (!announcement) throw new NotFoundException({ success: false, message: 'Announcement not found' });
    return buildLegacyDataEnvelope(await this.buildDetailPayload(announcement));
    });
  }

  async create(dto: Record<string, unknown>, user: Profile) {
    const data = this.buildAnnouncementInput(dto);
    data.author_id = user.id;
    data.status = (data.status as any) || 'draft';

    const created = await this.prisma.hr_announcements.create({ data, include: announcementInclude });
    await this.invalidateCache();
    return buildLegacyDataEnvelope(mapAnnouncement(created));
  }

  async update(id: number, dto: Record<string, unknown>, _user: Profile) {
    await this.findAnnouncement(id);
    const data = this.buildAnnouncementInput(dto);
    const updated = await this.prisma.hr_announcements.update({ where: { id }, data, include: announcementInclude });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyDataEnvelope(mapAnnouncement(updated));
  }

  async remove(id: number, _user: Profile) {
    await this.findAnnouncement(id);
    await this.prisma.hr_announcements.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Announcement deleted');
  }

  async publish(id: number, _user: Profile) {
    const announcement = await this.findAnnouncement(id);
    const now = new Date();
    const updated = await this.prisma.hr_announcements.update({
      where: { id },
      data: { status: 'published', publish_at: announcement.publish_at || now },
      include: announcementInclude,
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyDataEnvelope(mapAnnouncement(updated));
  }

  async acknowledge(id: number, user: Profile) {
    const announcement = await this.findAnnouncementRaw(id);
    const acknowledged = Array.isArray(announcement.acknowledged_by) ? [...announcement.acknowledged_by] : [];
    if (!acknowledged.find((x: any) => x.userId === user.id || x.user_id === user.id)) {
      acknowledged.push({ userId: user.id, acknowledgedAt: new Date().toISOString() });
    }
    const updated = await this.prisma.hr_announcements.update({
      where: { id },
      data: { acknowledged_by: asJsonInput(acknowledged) },
      include: announcementInclude,
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Acknowledged', mapAnnouncement(updated));
  }

  async react(id: number, dto: { reaction: string }, user: Profile) {
    const announcement = await this.findAnnouncementRaw(id);
    const reactions = (announcement.reactions && typeof announcement.reactions === 'object' && !Array.isArray(announcement.reactions)
      ? { ...(announcement.reactions as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    const reactionType = dto.reaction || 'like';
    const users = Array.isArray(reactions[reactionType]) ? [...(reactions[reactionType] as unknown[])] : [];
    if (!users.includes(user.id)) users.push(user.id);
    reactions[reactionType] = users;

    const updated = await this.prisma.hr_announcements.update({
      where: { id },
      data: { reactions: asJsonInput(reactions) },
      include: announcementInclude,
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyDataEnvelope(mapAnnouncement(updated));
  }

  async comment(id: number, dto: { comment: string }, user: Profile) {
    const announcement = await this.findAnnouncementRaw(id);
    const comments = Array.isArray(announcement.comments) ? [...announcement.comments] : [];
    comments.push({
      id: `${id}-${comments.length + 1}`,
      userId: user.id,
      comment: dto.comment,
      createdAt: new Date().toISOString(),
    });
    const updated = await this.prisma.hr_announcements.update({
      where: { id },
      data: { comments: asJsonInput(comments) },
      include: announcementInclude,
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyDataEnvelope(mapAnnouncement(updated));
  }

  private async findAnnouncement(id: number) {
    const announcement = await this.prisma.hr_announcements.findUnique({ where: { id }, include: announcementInclude });
    if (!announcement) throw new NotFoundException({ success: false, message: 'Announcement not found' });
    return announcement;
  }

  private async findAnnouncementRaw(id: number) {
    const announcement = await this.prisma.hr_announcements.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException({ success: false, message: 'Announcement not found' });
    return announcement;
  }

  private buildAnnouncementInput(dto: Record<string, unknown>): Prisma.hr_announcementsUncheckedCreateInput {
    const input: any = {};
    const set = (key: keyof typeof input, value: unknown) => {
      if (value !== undefined) input[key] = value;
    };
    set('title', dto.title);
    set('content', dto.content);
    set('content_html', dto.content_html);
    set('type', dto.type);
    set('priority', dto.priority);
    set('target_type', dto.target_type);
    set('target_departments', asJsonInput(dto.target_departments));
    set('target_positions', asJsonInput(dto.target_positions));
    set('target_employee_ids', asJsonInput(dto.target_employee_ids));
    set('status', dto.status);
    set('publish_at', parseDateOnly(dto.publish_at as string));
    set('expires_at', parseDateOnly(dto.expires_at as string));
    set('attachments', asJsonInput(dto.attachments));
    set('featured_image', dto.featured_image);
    set('require_acknowledgment', dto.require_acknowledgment);
    set('acknowledgment_deadline', parseDateOnly(dto.acknowledgment_deadline as string));
    set('allow_comments', dto.allow_comments);
    set('allow_reactions', dto.allow_reactions);
    set('is_pinned', dto.is_pinned);
    set('pin_order', dto.pin_order !== undefined ? Number(dto.pin_order) : undefined);
    set('send_push_notification', dto.send_push_notification);
    set('send_email', dto.send_email);
    set('visible_to_customers', dto.visible_to_customers);
    set('visible_to_agents', dto.visible_to_agents);
    set('visible_to_guests', dto.visible_to_guests);
    return input;
  }

  private async buildDetailPayload(announcement: Prisma.hr_announcementsGetPayload<{ include: typeof announcementInclude }>) {
    const payload = mapAnnouncement(announcement) as Record<string, unknown>;
    const comments = Array.isArray(payload.comments) ? payload.comments : [];
    const reactions = payload.reactions && typeof payload.reactions === 'object' ? (payload.reactions as Record<string, unknown>) : {};

    const participantIds = new Set<number>();
    participantIds.add(Number(payload.author_id));
    for (const c of comments) {
      const cid = (c).userId ?? (c).user_id ?? (c).author_id;
      if (cid) participantIds.add(Number(cid));
    }
    for (const ids of Object.values(reactions)) {
      if (Array.isArray(ids)) {
        for (const uid of ids) participantIds.add(Number(uid));
      }
    }

    const participant_profiles: Record<number, { first_name: string; last_name: string; avatar: string | null }> = {};
    if (participantIds.size > 0) {
      const profiles = await this.prisma.profiles.findMany({
        where: { id: { in: Array.from(participantIds) } },
        select: { id: true, first_name: true, last_name: true, avatar: true },
      });
      for (const p of profiles) {
        participant_profiles[p.id] = { first_name: p.first_name || '', last_name: p.last_name || '', avatar: p.avatar || null };
      }
    }

    const reaction_counts: Record<string, number> = {};
    let total_reactions = 0;
    for (const [type, ids] of Object.entries(reactions)) {
      const count = Array.isArray(ids) ? ids.length : 0;
      reaction_counts[type] = count;
      total_reactions += count;
    }

    return {
      ...payload,
      participant_profiles,
      reaction_counts,
      total_reactions,
      comment_count: comments.length,
    };
  }
}
