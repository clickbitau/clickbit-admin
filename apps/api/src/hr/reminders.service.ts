import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { buildLegacyDataEnvelope, buildLegacyListEnvelope, buildLegacyMessageEnvelope } from './hr-utils';
import { CacheService } from '../redis/cache.service';
import { EmailService } from '../common/email.service';

const profileSelect = { select: { id: true, first_name: true, last_name: true, email: true } } as const;

const reminderInclude = {
  profiles_hr_reminders_assigned_toToprofiles: profileSelect,
  profiles_hr_reminders_created_byToprofiles: profileSelect,
} as const;

function mapReminder(reminder: Prisma.hr_remindersGetPayload<{ include: typeof reminderInclude }>) {
  const r = reminder as unknown as Record<string, unknown>;
  return {
    ...r,
    creator: r.profiles_hr_reminders_created_byToprofiles,
    assignee: r.profiles_hr_reminders_assigned_toToprofiles,
    profiles_hr_reminders_assigned_toToprofiles: undefined,
    profiles_hr_reminders_created_byToprofiles: undefined,
  };
}

function parseDateOnly(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('reminders', ...parts) ?? `reminders:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
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

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: string;
    trigger_type?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    assigned_to?: string;
    created_by?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) {
    return this.cached(this.cacheKey('list', JSON.stringify(query)), async () => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.hr_remindersWhereInput = {};
    if (query.status) where.status = query.status as any;
    if (query.trigger_type) where.trigger_type = query.trigger_type as any;
    if (query.assigned_to) where.assigned_to = Number(query.assigned_to);
    if (query.created_by) where.created_by = Number(query.created_by);
    if (query.start_date || query.end_date) {
      where.reminder_date = {};
      if (query.start_date) (where.reminder_date as any).gte = parseDateOnly(query.start_date);
      if (query.end_date) (where.reminder_date as any).lte = parseDateOnly(query.end_date);
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.hr_remindersOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'reminder_date';
    const sortDir = query.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    (orderBy as any)[sortField] = sortDir;

    const [total, rows] = await Promise.all([
      this.prisma.hr_reminders.count({ where }),
      this.prisma.hr_reminders.findMany({ where, include: reminderInclude, orderBy, skip, take: limit }),
    ]);

    return buildLegacyListEnvelope(rows.map(mapReminder), total, page, limit);
    });
  }

  async findOne(id: number) {
    return this.cached(this.cacheKey('detail', id), async () => {
    const reminder = await this.prisma.hr_reminders.findUnique({ where: { id }, include: reminderInclude });
    if (!reminder) throw new NotFoundException({ success: false, message: 'Reminder not found' });
    return buildLegacyDataEnvelope(mapReminder(reminder));
    });
  }

  async create(dto: Record<string, unknown>, user: Profile) {
    const data: Prisma.hr_remindersUncheckedCreateInput = {
      title: dto.title as string,
      description: (dto.description as string) || null,
      trigger_type: (dto.trigger_type as any) || 'regular',
      reminder_date: parseDateOnly(dto.reminder_date as string)!,
      status: 'pending',
      send_email: dto.send_email !== undefined ? Boolean(dto.send_email) : true,
      reference_type: (dto.reference_type as string) || null,
      reference_id: dto.reference_id ? Number(dto.reference_id) : null,
      created_by: user.id,
      assigned_to: dto.assigned_to ? Number(dto.assigned_to) : null,
      notes: (dto.notes as string) || null,
    };
    const created = await this.prisma.hr_reminders.create({ data, include: reminderInclude });
    await this.invalidateCache();
    return buildLegacyDataEnvelope(mapReminder(created));
  }

  async update(id: number, dto: Record<string, unknown>, user: Profile) {
    const reminder = await this.findReminder(id);
    this.assertCanModify(reminder, user);

    const data: Prisma.hr_remindersUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title as string;
    if (dto.description !== undefined) data.description = (dto.description) || null;
    if (dto.trigger_type !== undefined) data.trigger_type = dto.trigger_type as any;
    if (dto.reminder_date !== undefined) data.reminder_date = parseDateOnly(dto.reminder_date as string);
    if (dto.reminder_date && reminder.status === 'initiation') data.status = 'pending';
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.send_email !== undefined) data.send_email = Boolean(dto.send_email);
    if (dto.reference_type !== undefined) data.reference_type = (dto.reference_type) || null;
    if (dto.reference_id !== undefined) data.reference_id = dto.reference_id ? Number(dto.reference_id) : null;
    if (dto.assigned_to !== undefined) data.assigned_to = dto.assigned_to ? Number(dto.assigned_to) : null;
    if (dto.notes !== undefined) data.notes = (dto.notes) || null;

    const updated = await this.prisma.hr_reminders.update({ where: { id }, data, include: reminderInclude });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyDataEnvelope(mapReminder(updated));
  }

  async remove(id: number, user: Profile) {
    const reminder = await this.findReminder(id);
    if (reminder.created_by !== user.id && !this.isAdminOrManager(user)) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to delete this reminder' });
    }
    await this.prisma.hr_reminders.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Reminder deleted successfully');
  }

  async complete(id: number, user: Profile) {
    const reminder = await this.findReminder(id);
    this.assertCanModify(reminder, user);
    const updated = await this.prisma.hr_reminders.update({
      where: { id },
      data: { status: 'complete' },
      include: reminderInclude,
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Reminder marked as complete', mapReminder(updated));
  }

  async sendEmail(id: number, _user: Profile) {
    const reminder = await this.prisma.hr_reminders.findUnique({
      where: { id },
      include: reminderInclude,
    });
    if (!reminder) throw new NotFoundException({ success: false, message: 'Reminder not found' });
    if (!reminder.send_email) {
      throw new BadRequestException({ success: false, message: 'Email notifications are disabled for this reminder. Enable send_email first.' });
    }

    const recipient = reminder.assigned_to
      ? reminder.profiles_hr_reminders_assigned_toToprofiles
      : reminder.profiles_hr_reminders_created_byToprofiles;
    if (!recipient || !recipient.email) {
      throw new BadRequestException({ success: false, message: 'No recipient email found for this reminder' });
    }

    const name = `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim() || recipient.email;
    const result = await this.emailService.send({
      to: recipient.email,
      subject: `Reminder: ${reminder.title}`,
      html: `
        <div style="font-family: Sora, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
          <h2 style="color: #1FBBD2;">Hi ${name},</h2>
          <p><strong>${reminder.title}</strong></p>
          <p>${reminder.description || ''}</p>
          <p><strong>Date:</strong> ${reminder.reminder_date ? new Date(reminder.reminder_date).toLocaleDateString('en-AU') : '—'}</p>
          <p><em>Trigger:</em> ${reminder.trigger_type}</p>
        </div>
      `,
    });

    if (!result.sent) {
      return buildLegacyMessageEnvelope(result.error || 'Failed to send reminder email');
    }

    await this.prisma.hr_reminders.update({
      where: { id },
      data: { email_sent: true, email_sent_at: new Date() },
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));

    return buildLegacyMessageEnvelope(`Reminder email sent to ${recipient.email}`);
  }

  private async findReminder(id: number) {
    const reminder = await this.prisma.hr_reminders.findUnique({ where: { id } });
    if (!reminder) throw new NotFoundException({ success: false, message: 'Reminder not found' });
    return reminder;
  }

  private assertCanModify(reminder: { created_by: number; assigned_to: number | null }, user: Profile) {
    const isAssignee = reminder.assigned_to != null && reminder.assigned_to === user.id;
    if (reminder.created_by !== user.id && !isAssignee && !this.isAdminOrManager(user)) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to edit this reminder' });
    }
  }
}
