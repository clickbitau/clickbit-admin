import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import {
  asJsonInput,
  buildAdminListEnvelope,
  buildLegacyDataEnvelope,
  generateTicketNumber,
  numberValue,
  safeDate,
  stringValue,
} from './support-utils';
import { CacheService } from '../redis/cache.service';

const profileSelect: Prisma.profilesSelect = { id: true, first_name: true, last_name: true, email: true, phone: true, avatar: true, role: true };
const profileBasic: Prisma.profilesSelect = { id: true, first_name: true, last_name: true, email: true };

function mapMessage(message: Record<string, unknown> & { profiles?: Record<string, unknown> | null }) {
  const sender = message.profiles;
  return { ...message, sender, profiles: undefined };
}

function mapProfileName(p?: Record<string, unknown> | null) {
  if (!p) return undefined;
  const first = typeof p.first_name === 'string' ? p.first_name : '';
  const last = typeof p.last_name === 'string' ? p.last_name : '';
  const email = typeof p.email === 'string' ? p.email : undefined;
  const name = `${first} ${last}`.trim() || email || undefined;
  return { ...(p), name, email };
}

function mapTicket(ticket: Record<string, unknown>): Record<string, unknown> {
  const t = { ...ticket };
  const user = t.profiles_tickets_user_idToprofiles as Record<string, unknown> | undefined;
  const assignee = t.profiles_tickets_assigned_toToprofiles as Record<string, unknown> | undefined;
  if (user) {
    t.user = mapProfileName(user);
    delete t.profiles_tickets_user_idToprofiles;
  }
  if (assignee) {
    t.assignee = mapProfileName(assignee);
    delete t.profiles_tickets_assigned_toToprofiles;
  }
  if (Array.isArray(t.ticket_messages)) {
    t.messages = t.ticket_messages.map((m) => mapMessage(m as Record<string, unknown> & { profiles?: Record<string, unknown> | null }));
    delete t.ticket_messages;
  }
  if (Array.isArray(t.ticket_watchers)) {
    t.watchers = t.ticket_watchers.map((w: any) => mapProfileName(w.profiles));
    delete t.ticket_watchers;
  }
  if (Array.isArray(t.ticket_time_logs)) {
    t.time_logs = t.ticket_time_logs.map((log: any) => ({
      ...log,
      user: mapProfileName(log.profiles),
      profiles: undefined,
    }));
    delete t.ticket_time_logs;
  }
  if (t.bug_reports_tickets_bug_report_idTobug_reports) {
    t.bug_report = t.bug_reports_tickets_bug_report_idTobug_reports;
    delete t.bug_reports_tickets_bug_report_idTobug_reports;
  }
  if (t.tickets) {
    t.parent_ticket = t.tickets;
    delete t.tickets;
  }
  if (Array.isArray(t.other_tickets)) {
    t.child_tickets = t.other_tickets;
    delete t.other_tickets;
  }
  if (t.last_activity_at !== undefined) {
    t.last_reply_at = t.last_activity_at;
  }
  return t;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('tickets', ...parts) ?? `tickets:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
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

  // ─── Public create ──────────────────────────────────────────────────────────

  async create(dto: Record<string, unknown>, reqUser?: Profile) {
    const subject = stringValue(dto.subject || '');
    const description = stringValue(dto.description || '');
    if (!subject || !description) {
      throw new BadRequestException({ message: 'Subject and description are required' });
    }

    const userId = reqUser?.id ?? null;
    const guestName = userId ? null : stringValue(dto.guest_name || '');
    const guestEmail = userId ? null : stringValue(dto.guest_email || '');
    const contactEmail = (reqUser?.email?.trim().toLowerCase() || guestEmail || '').trim().toLowerCase();

    if (!userId && (!guestName || !guestEmail)) {
      throw new BadRequestException({ message: 'Guest name and email are required for non-authenticated users' });
    }

    const relatedOrderId = dto.related_order_id ? Number(dto.related_order_id) : null;
    if (relatedOrderId) {
      const order = await this.prisma.orders.findUnique({ where: { id: relatedOrderId } });
      if (!order) throw new BadRequestException({ message: 'Related order not found' });
    }

    const category = stringValue(dto.category || 'general');
    const priority = stringValue(dto.priority || 'medium');
    const tags = asJsonInput<string[]>(dto.tags, []);
    const attachments = asJsonInput<unknown[]>(dto.attachments, []);

    const ticketNumber = await generateTicketNumber(this.prisma);
    const data: Prisma.ticketsUncheckedCreateInput = {
      ticket_number: ticketNumber,
      subject,
      description,
      category: category as any,
      priority: priority as any,
      user_id: userId,
      guest_name: guestName || null,
      guest_email: guestEmail || null,
      contact_email: contactEmail,
      related_order_id: relatedOrderId,
      tags: tags,
      attachments: attachments,
      source: 'web',
      last_activity_at: new Date(),
    };

    const ticket = await this.prisma.tickets.create({ data });

    await this.prisma.ticket_messages.create({
      data: {
        ticket_id: ticket.id,
        user_id: userId,
        message: description,
        message_type: 'reply',
        is_staff_reply: false,
        is_internal: false,
        sender_name: userId ? null : guestName,
        sender_email: contactEmail,
        attachments: attachments,
      },
    });

    await this.notifyAdminsOfNewTicket(ticket, reqUser, subject, category, priority);
    await this.invalidateCache();

    return {
      message: 'Ticket created successfully',
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        created_at: ticket.created_at,
        last_activity_at: ticket.last_activity_at,
        auto_fix_status: ticket.auto_fix_status,
        bug_report_id: ticket.bug_report_id,
      },
      auto_fix: null,
    };
  }

  // ─── Quota & purchases (simplified) ────────────────────────────────────────

  async getQuota(user: Profile) {
    const quota = await this.prisma.ticket_quotas.findUnique({ where: { profile_id: user.id } });
    const now = new Date();
    const startOfPeriod = this.getPeriodStart(now, quota?.period || 'monthly');
    const used = await this.prisma.tickets.count({
      where: { user_id: user.id, created_at: { gte: startOfPeriod } },
    });
    const limit = quota?.free_limit ?? 5;
    return {
      metered: true,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      period: quota?.period || 'monthly',
      requires_payment: used >= limit,
      price_cents: quota?.price_cents ?? 5000,
      currency: quota?.currency || 'AUD',
    };
  }

  private getPeriodStart(now: Date, period: string) {
    const d = new Date(now);
    if (period === 'weekly') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
    } else {
      d.setDate(1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  }

  verifyPurchase(_sessionId: string) {
    return Promise.resolve({ success: true, status: 'paid' });
  }

  async assignAi(id: number, _dto: Record<string, unknown>, _user: Profile) {
    const ticket = await this.findRaw(id);
    if (ticket.bug_report_id) {
      throw new BadRequestException({ message: 'Ticket already routed to the AI fix pipeline', bug_report_id: ticket.bug_report_id });
    }
    const updated = await this.prisma.tickets.update({
      where: { id },
      data: { auto_fix_status: 'manual_review', updated_at: new Date() },
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return {
      success: true,
      message: 'Ticket routed to AI fix pipeline',
      ticket: { id: updated.id, ticket_number: updated.ticket_number, auto_fix_status: updated.auto_fix_status, bug_report_id: updated.bug_report_id },
      bug_report_id: null,
    };
  }

  // ─── Public track ───────────────────────────────────────────────────────────

  async track(ticketNumber: string, email?: string) {
    if (!email) throw new BadRequestException({ message: 'Email is required to track ticket' });
    const ticket = await this.prisma.tickets.findFirst({
      where: { ticket_number: ticketNumber, contact_email: email.toLowerCase() },
      include: {
        ticket_messages: { where: { is_internal: false }, orderBy: { created_at: 'asc' as const }, include: { profiles: { select: profileBasic } } },
        profiles_tickets_assigned_toToprofiles: { select: profileBasic },
      },
    });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found or email does not match' });
    return buildLegacyDataEnvelope(mapTicket(ticket as unknown as Record<string, unknown>));
  }

  async trackReply(ticketNumber: string, dto: Record<string, unknown>) {
    const email = stringValue(dto.email || '');
    const message = stringValue(dto.message || '');
    const attachments = asJsonInput<unknown[]>(dto.attachments, []);
    if (!email) throw new BadRequestException({ message: 'Email is required' });

    const ticket = await this.prisma.tickets.findFirst({
      where: { ticket_number: ticketNumber, contact_email: email.toLowerCase() },
    });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found or email does not match' });
    if (ticket.status === 'closed') throw new BadRequestException({ message: 'Cannot reply to a closed ticket. Please create a new ticket.' });

    const created = await this.prisma.ticket_messages.create({
      data: {
        ticket_id: ticket.id,
        user_id: ticket.user_id,
        message,
        message_type: 'reply',
        is_staff_reply: false,
        is_internal: false,
        sender_name: ticket.guest_name || 'Customer',
        sender_email: email,
        attachments,
      },
    });

    const updates: Prisma.ticketsUncheckedUpdateInput = { last_activity_at: new Date() };
    if (ticket.status === 'waiting_customer') updates.status = 'waiting_staff';
    await this.prisma.tickets.update({ where: { id: ticket.id }, data: updates });

    await this.invalidateCache();
    return { message: 'Reply added successfully', reply: created };
  }

  async trackFeedback(ticketNumber: string, dto: Record<string, unknown>) {
    const email = stringValue(dto.email || '');
    const rating = numberValue(dto.rating);
    const feedback = stringValue(dto.feedback || '');
    if (!email || !rating) throw new BadRequestException({ message: 'Email and rating are required' });
    if (rating < 1 || rating > 5) throw new BadRequestException({ message: 'Rating must be between 1 and 5' });

    const ticket = await this.prisma.tickets.findFirst({
      where: { ticket_number: ticketNumber, contact_email: email.toLowerCase() },
    });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found or email does not match' });

    await this.prisma.tickets.update({
      where: { id: ticket.id },
      data: { satisfaction_rating: rating, satisfaction_feedback: feedback || null },
    });
    await this.invalidateCache();
    return { message: 'Thank you for your feedback!' };
  }

  // ─── Customer my-tickets ────────────────────────────────────────────────────

  async getMyTickets(user: Profile, query: { status?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const scope: Prisma.ticketsWhereInput[] = [{ user_id: user.id }, { contact_email: user.email }];
    const search: Prisma.ticketsWhereInput[] = [];
    if (query.search) {
      search.push(
        { ticket_number: { contains: query.search, mode: 'insensitive' } },
        { subject: { contains: query.search, mode: 'insensitive' } },
      );
    }
    const ands: Prisma.ticketsWhereInput[] = [{ OR: scope }];
    if (search.length) ands.push({ OR: search });
    const where: any = ands.length === 1 ? ands[0]! : { AND: ands };
    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    const [count, rows] = await Promise.all([
      this.prisma.tickets.count({ where }),
      this.prisma.tickets.findMany({
        where,
        select: {
          id: true,
          ticket_number: true,
          subject: true,
          status: true,
          priority: true,
          category: true,
          created_at: true,
          last_activity_at: true,
          profiles_tickets_assigned_toToprofiles: { select: profileBasic },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip,
      }),
    ]);

    const mapped = rows.map((t) => mapTicket(t as unknown as Record<string, unknown>));
    return {
      tickets: mapped,
      pagination: { currentPage: page, totalPages: Math.ceil(count / limit) || 1, totalItems: count, itemsPerPage: limit },
    };
  }

  async getMyTicketById(id: number, user: Profile) {
    const ticket = await this.prisma.tickets.findFirst({
      where: { id, OR: [{ user_id: user.id }, { contact_email: user.email }] },
      include: {
        profiles_tickets_user_idToprofiles: { select: profileSelect },
        profiles_tickets_assigned_toToprofiles: { select: profileBasic },
        ticket_messages: {
          where: { is_internal: false },
          orderBy: { created_at: 'asc' as const },
          include: { profiles: { select: profileSelect } },
        },
      },
    });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found' });

    await this.markCustomerMessagesRead(ticket.id);
    return mapTicket(ticket);
  }

  async replyToMyTicket(id: number, user: Profile, dto: Record<string, unknown>) {
    const message = stringValue(dto.message || '');
    const attachments = asJsonInput<unknown[]>(dto.attachments, []);
    const trimmed = message.trim();
    if (!trimmed && attachments.length === 0) throw new BadRequestException({ message: 'Message or attachment is required' });

    const ticket = await this.prisma.tickets.findFirst({
      where: { id, OR: [{ user_id: user.id }, { contact_email: user.email }] },
    });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found' });
    if (ticket.status === 'closed') throw new BadRequestException({ message: 'Cannot reply to a closed ticket' });

    const finalMessage = trimmed || `Shared ${attachments.length} file(s)`;
    const created = await this.prisma.ticket_messages.create({
      data: {
        ticket_id: ticket.id,
        user_id: user.id,
        message: finalMessage,
        message_type: 'reply',
        is_staff_reply: false,
        is_internal: false,
        sender_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        sender_email: user.email,
        attachments,
      },
    });

    const updates: Prisma.ticketsUncheckedUpdateInput = { last_activity_at: new Date() };
    if (ticket.status === 'waiting_customer' || ticket.status === 'resolved') updates.status = 'waiting_staff';
    await this.prisma.tickets.update({ where: { id: ticket.id }, data: updates });

    await this.invalidateCache();

    if (ticket.assigned_to && ticket.assigned_to !== user.id) {
      await this.createNotification({
        user_id: ticket.assigned_to,
        title: `Customer Reply: ${ticket.ticket_number}`,
        message: `${user.first_name || ''} replied to "${ticket.subject}"`,
        source: 'ticket',
        metadata: JSON.stringify({ ticket_id: ticket.id, ticket_number: ticket.ticket_number }),
      });
    }

    await this.invalidateCache();
    return { message: 'Reply added successfully', reply: created };
  }

  async reopenMyTicket(id: number, user: Profile) {
    const ticket = await this.prisma.tickets.findFirst({
      where: { id, OR: [{ user_id: user.id }, { contact_email: user.email }], status: { in: ['resolved', 'closed'] } },
    });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found or cannot be reopened' });

    const updated = await this.prisma.tickets.update({
      where: { id: ticket.id },
      data: { status: 'open', resolved_at: null, closed_at: null, last_activity_at: new Date() },
    });

    await this.prisma.ticket_messages.create({
      data: {
        ticket_id: ticket.id,
        user_id: user.id,
        message: 'Ticket reopened by customer',
        message_type: 'system',
        is_staff_reply: true,
        is_internal: true,
        sender_name: 'System',
      },
    });

    await this.invalidateCache();
    return { message: 'Ticket reopened successfully', ticket: updated };
  }

  // ─── Staff my-assigned ────────────────────────────────────────────────────────

  async getMyAssigned(user: Profile, query: { status?: string; search?: string }) {
    const where: Prisma.ticketsWhereInput = { assigned_to: user.id };
    if (query.status && query.status !== 'all') (where as any).status = query.status;
    if (query.search) {
      (where as any).OR = [
        { ticket_number: { contains: query.search, mode: 'insensitive' } },
        { subject: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.tickets.findMany({
      where,
      select: {
        id: true,
        ticket_number: true,
        subject: true,
        status: true,
        priority: true,
        category: true,
        created_at: true,
        last_activity_at: true,
        profiles_tickets_user_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy: { last_activity_at: 'desc' },
    });

    return { tickets: rows.map((t) => mapTicket(t as unknown as Record<string, unknown>)) };
  }

  async getMyAssignedById(id: number, user: Profile) {
    const ticket = await this.prisma.tickets.findFirst({
      where: { id, assigned_to: user.id },
      include: {
        profiles_tickets_user_idToprofiles: { select: profileSelect },
        profiles_tickets_assigned_toToprofiles: { select: profileBasic },
        ticket_messages: {
          where: { is_internal: false },
          orderBy: { created_at: 'asc' as const },
          include: { profiles: { select: profileSelect } },
        },
      },
    });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found or not assigned to you' });
    return ticket;
  }

  async replyToMyAssigned(id: number, user: Profile, dto: Record<string, unknown>) {
    const message = stringValue(dto.message || '');
    const isInternal = Boolean(dto.is_internal);
    const attachments = asJsonInput<unknown[]>(dto.attachments, []);
    const trimmed = message.trim();
    if (!trimmed && attachments.length === 0) throw new BadRequestException({ message: 'Message or attachment is required' });

    const ticket = await this.prisma.tickets.findFirst({ where: { id, assigned_to: user.id } });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found or not assigned to you' });
    if (ticket.status === 'closed') throw new BadRequestException({ message: 'Cannot reply to a closed ticket' });

    const finalMessage = trimmed || `Shared ${attachments.length} file(s)`;
    const created = await this.prisma.ticket_messages.create({
      data: {
        ticket_id: ticket.id,
        user_id: user.id,
        message: finalMessage,
        message_type: isInternal ? 'internal_note' : 'reply',
        is_staff_reply: true,
        is_internal: isInternal,
        sender_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        sender_email: user.email,
        attachments,
      },
    });

    const updates: Prisma.ticketsUncheckedUpdateInput = { last_activity_at: new Date() };
    if (!isInternal && (ticket.status === 'open' || ticket.status === 'waiting_staff')) updates.status = 'waiting_customer';
    await this.prisma.tickets.update({ where: { id: ticket.id }, data: updates });

    await this.invalidateCache();
    return { message: 'Reply sent', reply: created };
  }

  async updateMyAssignedStatus(id: number, user: Profile, status: string) {
    const allowed = ['open', 'in_progress', 'waiting_customer', 'waiting_staff', 'resolved'];
    if (!allowed.includes(status)) throw new BadRequestException({ message: `Status must be one of: ${allowed.join(', ')}` });

    const ticket = await this.prisma.tickets.findFirst({ where: { id, assigned_to: user.id } });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found or not assigned to you' });

    const updates: Prisma.ticketsUncheckedUpdateInput = { status: status as any, last_activity_at: new Date() };
    if (status === 'resolved') updates.resolved_at = new Date();
    const updated = await this.prisma.tickets.update({ where: { id: ticket.id }, data: updates });

    await this.prisma.ticket_messages.create({
      data: {
        ticket_id: ticket.id,
        user_id: user.id,
        message: `Status changed from ${ticket.status} to ${status}`,
        message_type: 'status_change',
        is_staff_reply: true,
        is_internal: true,
        sender_name: 'System',
      },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { success: true, message: 'Status updated', status: updated.status };
  }

  // ─── Admin ───────────────────────────────────────────────────────────────────

  async findAllAdmin(user: Profile, query: Record<string, unknown>) {
    const cacheKey = this.cacheKey('admin-list', user.id, user.role, JSON.stringify(query));
    return this.cached(cacheKey, async () => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;
    const sortBy = stringValue(query.sortBy || 'created_at');
    const sortOrder = stringValue(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const where: Prisma.ticketsWhereInput = {};
    const status = query.status ? stringValue(query.status) : undefined;
    if (status && status !== 'all') {
      if (status === 'open_all') {
        (where as any).status = { in: ['open', 'in_progress', 'waiting_customer', 'waiting_staff'] };
      } else {
        (where as any).status = status;
      }
    }
    if (query.priority && query.priority !== 'all') (where as any).priority = stringValue(query.priority);
    if (query.category && query.category !== 'all') (where as any).category = stringValue(query.category);

    const assignedTo = query.assigned_to ? stringValue(query.assigned_to) : undefined;
    if (assignedTo) {
      if (assignedTo === 'unassigned') (where as any).assigned_to = null;
      else if (assignedTo === 'me') (where as any).assigned_to = user.id;
      else (where as any).assigned_to = Number(assignedTo);
    }

    if (query.search) {
      const s = stringValue(query.search);
      (where as any).OR = [
        { ticket_number: { contains: s, mode: 'insensitive' } },
        { subject: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { contact_email: { contains: s, mode: 'insensitive' } },
        { guest_name: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      (where as any).created_at = {};
      if (query.dateFrom) (where as any).created_at.gte = safeDate(stringValue(query.dateFrom));
      if (query.dateTo) {
        const end = safeDate(stringValue(query.dateTo));
        if (end) {
          end.setDate(end.getDate() + 1);
          (where as any).created_at.lt = end;
        }
      }
    }

    const orderBy: Prisma.ticketsOrderByWithRelationInput = {};
    (orderBy as any)[sortBy] = sortOrder;

    const [count, rows] = await Promise.all([
      this.prisma.tickets.count({ where }),
      this.prisma.tickets.findMany({
        where,
        include: {
          profiles_tickets_user_idToprofiles: { select: profileBasic },
          profiles_tickets_assigned_toToprofiles: { select: profileBasic },
        },
        orderBy,
        take: limit,
        skip,
      }),
    ]);

    const ticketIds = rows.map((t) => t.id);
    const unreadRows = ticketIds.length
      ? await this.prisma.ticket_messages.groupBy({
          by: ['ticket_id'],
          where: { ticket_id: { in: ticketIds }, is_staff_reply: false, read_at: null },
          _count: { ticket_id: true },
        })
      : [];
    const unreadMap = new Map(unreadRows.map((u) => [u.ticket_id, u._count.ticket_id]));
    const withUnread = rows.map((t) => ({ ...mapTicket(t), unread_count: unreadMap.get(t.id) || 0 }));

    return buildAdminListEnvelope(withUnread, count, page, limit);
    });
  }

  async getStats(period?: number) {
    const cacheKey = this.cacheKey('stats', period ?? 30);
    return this.cached(cacheKey, async () => {
    const days = Number(period) || 30;
    const start = new Date();
    start.setDate(start.getDate() - days);

    const [statusCounts, priorityCounts, categoryCounts, newCount, resolvedCount, unassigned, overdue] = await Promise.all([
      this.prisma.tickets.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.tickets.groupBy({
        by: ['priority'],
        where: { status: { in: ['open', 'in_progress', 'waiting_customer', 'waiting_staff'] } },
        _count: { id: true },
      }),
      this.prisma.tickets.groupBy({ by: ['category'], where: { created_at: { gte: start } }, _count: { id: true } }),
      this.prisma.tickets.count({ where: { created_at: { gte: start } } }),
      this.prisma.tickets.count({ where: { resolved_at: { gte: start } } }),
      this.prisma.tickets.count({
        where: { assigned_to: null, status: { in: ['open', 'in_progress', 'waiting_staff'] } },
      }),
      this.prisma.tickets.count({
        where: {
          status: { in: ['open', 'waiting_staff'] },
          first_response_at: null,
          created_at: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const byAssignee = await this.prisma.tickets.groupBy({
      by: ['assigned_to'],
      where: { assigned_to: { not: null }, status: { in: ['open', 'in_progress', 'waiting_customer', 'waiting_staff'] } },
      _count: { id: true },
    });

    const statusObj: Record<string, number> = { open: 0, in_progress: 0, waiting_customer: 0, waiting_staff: 0, resolved: 0, closed: 0 };
    statusCounts.forEach((s) => { statusObj[s.status as string] = s._count.id; });
    const openTotal = statusObj.open + statusObj.in_progress + statusObj.waiting_customer + statusObj.waiting_staff;

    const firstResponse = await this.prisma.$queryRawUnsafe<Array<{ avg_hours: number | null }>>(
      `SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600) as avg_hours FROM public.tickets WHERE first_response_at IS NOT NULL AND created_at >= $1`,
      start,
    );
    const resolution = await this.prisma.$queryRawUnsafe<Array<{ avg_hours: number | null }>>(
      `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours FROM public.tickets WHERE resolved_at IS NOT NULL AND created_at >= $1`,
      start,
    );
    const satisfaction = await this.prisma.$queryRawUnsafe<Array<{ avg_rating: number | null; total_ratings: number | null }>>(
      `SELECT AVG(satisfaction_rating) as avg_rating, COUNT(satisfaction_rating) as total_ratings FROM public.tickets WHERE satisfaction_rating IS NOT NULL`,
    );

    const total = await this.prisma.tickets.count();

    return {
      overview: { total, open: openTotal, unassigned: unassigned, overdue: overdue, newThisPeriod: newCount, resolvedThisPeriod: resolvedCount },
      byStatus: statusObj,
      byPriority: priorityCounts.reduce((acc, p) => ({ ...acc, [p.priority as string]: p._count.id }), {} as Record<string, number>),
      byCategory: categoryCounts.reduce((acc, c) => ({ ...acc, [c.category as string]: c._count.id }), {} as Record<string, number>),
      byAssignee: byAssignee.map((a) => ({ id: a.assigned_to, count: a._count.id })).filter((a) => a.id !== null),
      performance: {
        avgFirstResponseHours: parseFloat(stringValue(firstResponse[0]?.avg_hours)) || null,
        avgResolutionHours: parseFloat(stringValue(resolution[0]?.avg_hours)) || null,
        avgSatisfactionRating: parseFloat(stringValue(satisfaction[0]?.avg_rating)) || null,
        totalRatings: Number(satisfaction[0]?.total_ratings) || 0,
      },
      period: days,
    };
    });
  }

  async getStaff() {
    const staff = await this.prisma.profiles.findMany({
      where: { role: { in: ['admin', 'manager', 'employee'] }, status: 'active' },
      select: { id: true, first_name: true, last_name: true, email: true, role: true },
    });

    const staffIds = staff.map((s) => s.id);
    const openCounts = staffIds.length
      ? await this.prisma.tickets.groupBy({
          by: ['assigned_to'],
          where: { assigned_to: { in: staffIds }, status: { in: ['open', 'in_progress', 'waiting_customer', 'waiting_staff'] } },
          _count: { id: true },
        })
      : [];
    const countMap = new Map(openCounts.map((c) => [c.assigned_to, c._count.id]));
    const withCounts = staff.map((s) => ({ ...s, open_tickets_count: countMap.get(s.id) || 0 }));

    return withCounts;
  }

  async getCannedResponses() {
    const setting = await this.prisma.site_settings.findFirst({ where: { setting_key: 'ticket_canned_responses' } });
    if (setting?.setting_value) {
      try {
        return JSON.parse(setting.setting_value);
      } catch {
        // fall through to defaults
      }
    }
    return [
      { id: 1, title: 'Thank You for Contacting Us', content: 'Thank you for reaching out. We will get back to you within 24-48 hours.', category: 'general' },
      { id: 2, title: 'Request More Information', content: 'To better assist you, could you please provide more details?', category: 'general' },
      { id: 3, title: 'Issue Resolved', content: 'Your issue has been resolved. Please reach out if you need further help.', category: 'resolution' },
      { id: 4, title: 'Technical Support - Next Steps', content: 'Please try clearing your browser cache and let us know the results.', category: 'technical' },
    ];
  }

  async saveCannedResponses(responses: unknown[]) {
    const value = JSON.stringify(responses);
    const existing = await this.prisma.site_settings.findFirst({ where: { setting_key: 'ticket_canned_responses' } });
    if (existing) {
      await this.prisma.site_settings.update({ where: { id: existing.id }, data: { setting_value: value } });
    } else {
      const now = new Date();
      await this.prisma.site_settings.create({
        data: {
          setting_key: 'ticket_canned_responses',
          setting_value: value,
          setting_type: 'system',
          description: 'Canned responses for ticket replies',
          created_at: now,
          updated_at: now,
        },
      });
    }
    return { message: 'Canned responses saved successfully' };
  }

  async exportCsv(query: Record<string, unknown>) {
    const where: Prisma.ticketsWhereInput = {};
    if (query.status && query.status !== 'all') (where as any).status = stringValue(query.status);
    if (query.priority && query.priority !== 'all') (where as any).priority = stringValue(query.priority);
    if (query.category && query.category !== 'all') (where as any).category = stringValue(query.category);
    if (query.dateFrom || query.dateTo) {
      (where as any).created_at = {};
      if (query.dateFrom) (where as any).created_at.gte = safeDate(stringValue(query.dateFrom));
      if (query.dateTo) {
        const end = safeDate(stringValue(query.dateTo));
        if (end) {
          end.setDate(end.getDate() + 1);
          (where as any).created_at.lt = end;
        }
      }
    }

    const rows = await this.prisma.tickets.findMany({
      where,
      include: {
        profiles_tickets_user_idToprofiles: { select: profileBasic },
        profiles_tickets_assigned_toToprofiles: { select: profileBasic },
      },
      orderBy: { created_at: 'desc' },
    });

    const header = 'Ticket Number,Subject,Status,Priority,Category,Customer Name,Customer Email,Assigned To,Created At,First Response,Resolved At,Satisfaction Rating\n';
    const csv = rows
      .map((t) => {
        const user = t.profiles_tickets_user_idToprofiles;
        const assignee = t.profiles_tickets_assigned_toToprofiles;
        const customerName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : t.guest_name || 'Guest';
        const assigneeName = assignee ? `${assignee.first_name || ''} ${assignee.last_name || ''}`.trim() : 'Unassigned';
        return [
          t.ticket_number,
          `"${(t.subject || '').replace(/"/g, '""')}"`,
          t.status,
          t.priority,
          t.category,
          `"${customerName}"`,
          t.contact_email,
          `"${assigneeName}"`,
          t.created_at?.toISOString() || '',
          t.first_response_at?.toISOString() || '',
          t.resolved_at?.toISOString() || '',
          t.satisfaction_rating || '',
        ].join(',');
      })
      .join('\n');

    return { csv: header + csv, filename: `tickets-${new Date().toISOString().split('T')[0]}.csv` };
  }

  async findOneAdmin(id: number) {
    const ticket = await this.prisma.tickets.findUnique({
      where: { id },
      include: {
        profiles_tickets_user_idToprofiles: { select: profileSelect },
        profiles_tickets_assigned_toToprofiles: { select: profileBasic },
        crm_projects: true,
        deals: true,
        bug_reports_tickets_bug_report_idTobug_reports: { select: { id: true, title: true, status: true } },
        tickets: true,
        other_tickets: { select: { id: true, ticket_number: true, subject: true, status: true } },
        ticket_messages: { orderBy: { created_at: 'asc' as const }, include: { profiles: { select: profileSelect } } },
        ticket_watchers: { include: { profiles: { select: profileBasic } } },
        ticket_time_logs: { orderBy: { created_at: 'desc' as const }, include: { profiles: { select: profileBasic } } },
      },
    });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found' });

    await this.markCustomerMessagesRead(ticket.id);
    return mapTicket(ticket);
  }

  async updateAdmin(id: number, user: Profile, dto: Record<string, unknown>) {
    const ticket = await this.findRaw(id);
    const oldAssignee = ticket.assigned_to;

    const updates: Prisma.ticketsUncheckedUpdateInput = {};
    if (dto.subject !== undefined) updates.subject = stringValue(dto.subject);
    if (dto.status !== undefined) updates.status = stringValue(dto.status) as any;
    if (dto.priority !== undefined) updates.priority = stringValue(dto.priority) as any;
    if (dto.category !== undefined) updates.category = stringValue(dto.category) as any;
    if (dto.tags !== undefined) updates.tags = asJsonInput<string[]>(dto.tags, []);
    if (dto.internal_notes !== undefined) updates.internal_notes = stringValue(dto.internal_notes) || null;
    if (dto.assigned_to !== undefined) {
      const assignedTo = dto.assigned_to === null || dto.assigned_to === '' ? null : Number(dto.assigned_to);
      updates.assigned_to = assignedTo;
      if (assignedTo !== oldAssignee) {
        await this.prisma.ticket_messages.create({
          data: {
            ticket_id: id,
            user_id: user.id,
            message: `Assignment changed from ${oldAssignee || 'Unassigned'} to ${assignedTo || 'Unassigned'}`,
            message_type: 'assignment_change',
            is_staff_reply: true,
            is_internal: true,
            sender_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
            sender_email: user.email,
          },
        });
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date();
      await this.prisma.tickets.update({ where: { id }, data: updates });
    }

    if (dto.status && dto.status !== ticket.status) {
      await this.prisma.ticket_messages.create({
        data: {
          ticket_id: id,
          user_id: user.id,
          message: `Status changed from ${ticket.status} to ${stringValue(dto.status)}`,
          message_type: 'status_change',
          is_staff_reply: true,
          is_internal: true,
          sender_name: 'System',
        },
      });
    }

    const updated = await this.prisma.tickets.findUnique({
      where: { id },
      include: { profiles_tickets_user_idToprofiles: { select: profileBasic }, profiles_tickets_assigned_toToprofiles: { select: profileBasic } },
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Ticket updated successfully', ticket: mapTicket(updated as unknown as Record<string, unknown>) };
  }

  async replyAdmin(id: number, user: Profile, dto: Record<string, unknown>) {
    const ticket = await this.findRaw(id);
    const message = stringValue(dto.message || '');
    const isInternal = Boolean(dto.is_internal);
    const attachments = asJsonInput<unknown[]>(dto.attachments, []);

    const created = await this.prisma.ticket_messages.create({
      data: {
        ticket_id: ticket.id,
        user_id: user.id,
        message,
        message_type: isInternal ? 'internal_note' : 'reply',
        is_staff_reply: true,
        is_internal: isInternal,
        sender_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        sender_email: user.email,
        attachments,
      },
    });

    const updates: Prisma.ticketsUncheckedUpdateInput = { last_activity_at: new Date(), updated_at: new Date() };
    if (!isInternal && !ticket.first_response_at) updates.first_response_at = new Date();

    if (dto.update_status) updates.status = stringValue(dto.update_status) as any;
    else if (!isInternal && ticket.status === 'open') updates.status = 'in_progress';
    else if (!isInternal && ticket.status === 'waiting_staff') updates.status = 'waiting_customer';

    if (!ticket.assigned_to) {
      updates.assigned_to = user.id;
      await this.prisma.ticket_messages.create({
        data: {
          ticket_id: ticket.id,
          user_id: user.id,
          message: `Assigned to ${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
          message_type: 'assignment_change',
          is_staff_reply: true,
          is_internal: true,
          sender_name: 'System',
        },
      });
    }

    await this.prisma.tickets.update({ where: { id: ticket.id }, data: updates });

    const updated = await this.prisma.tickets.findUnique({
      where: { id: ticket.id },
      include: { profiles_tickets_user_idToprofiles: { select: profileBasic }, profiles_tickets_assigned_toToprofiles: { select: profileBasic }, ticket_messages: { orderBy: { created_at: 'asc' }, include: { profiles: { select: profileSelect } } } },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Reply added successfully', reply: created, ticket: mapTicket(updated as unknown as Record<string, unknown>) };
  }

  async bulkUpdate(user: Profile, dto: Record<string, unknown>) {
    const ids = asJsonInput<number[]>(dto.ticket_ids, []);
    const action = stringValue(dto.action || '');
    const value = dto.value === undefined ? undefined : stringValue(dto.value);
    if (!ids.length) throw new BadRequestException({ message: 'ticket_ids array is required' });
    if (!action) throw new BadRequestException({ message: 'action is required' });

    const updates: Prisma.ticketsUncheckedUpdateInput = {};
    let logMessage = '';
    switch (action) {
      case 'assign':
        updates.assigned_to = value === undefined || value === '' ? null : Number(value);
        logMessage = value ? `Bulk assigned to user ${value}` : 'Bulk unassigned';
        break;
      case 'status':
        if (!value || !['open', 'in_progress', 'waiting_customer', 'waiting_staff', 'resolved', 'closed'].includes(value)) {
          throw new BadRequestException({ message: 'Invalid status value' });
        }
        updates.status = value as any;
        logMessage = `Bulk status change to ${value}`;
        break;
      case 'priority':
        if (!value || !['low', 'medium', 'high', 'urgent'].includes(value)) throw new BadRequestException({ message: 'Invalid priority value' });
        updates.priority = value as any;
        logMessage = `Bulk priority change to ${value}`;
        break;
      case 'category':
        if (!value) throw new BadRequestException({ message: 'Invalid category value' });
        updates.category = value as any;
        logMessage = `Bulk category change to ${value}`;
        break;
      default:
        throw new BadRequestException({ message: 'Invalid action' });
    }

    await this.prisma.tickets.updateMany({ where: { id: { in: ids } }, data: { ...updates, updated_at: new Date() } });
    const tickets = await this.prisma.tickets.findMany({ where: { id: { in: ids } } });
    if (tickets.length > 0) {
      await this.prisma.ticket_messages.createMany({
        data: tickets.map((ticket) => ({
          ticket_id: ticket.id,
          user_id: user.id,
          message: logMessage,
          message_type: 'system',
          is_staff_reply: true,
          is_internal: true,
          sender_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
          sender_email: user.email,
        })),
      });
    }

    await this.invalidateCache();
    return { message: `Successfully updated ${tickets.length} ticket(s)`, updated_count: tickets.length };
  }

  async merge(user: Profile, dto: Record<string, unknown>) {
    const primaryId = Number(dto.primary_ticket_id);
    const secondaryIds = asJsonInput<number[]>(dto.secondary_ticket_ids, []);
    if (!primaryId || !secondaryIds.length) throw new BadRequestException({ message: 'primary_ticket_id and secondary_ticket_ids are required' });

    const primary = await this.findRaw(primaryId);
    const secondaries = await this.prisma.tickets.findMany({
      where: { id: { in: secondaryIds } },
      include: { ticket_messages: true },
    });
    if (!secondaries.length) throw new NotFoundException({ message: 'No tickets found' });

    if (secondaries.length > 0) {
      await this.prisma.ticket_messages.createMany({
        data: secondaries.map((t) => ({
          ticket_id: primary.id,
          user_id: user.id,
          message: `--- Merged from ticket ${t.ticket_number} ---\nOriginal subject: ${t.subject}`,
          message_type: 'system',
          is_staff_reply: true,
          is_internal: true,
          sender_name: 'System',
        })),
      });
    }

    await Promise.all(
      secondaries.map((t) =>
        this.prisma.$transaction([
          this.prisma.ticket_messages.updateMany({
            where: { ticket_id: t.id },
            data: { ticket_id: primary.id },
          }),
          this.prisma.tickets.update({
            where: { id: t.id },
            data: { status: 'closed', internal_notes: `${t.internal_notes || ''}\n[Merged into ${primary.ticket_number}]` },
          }),
        ]),
      ),
    );

    await this.prisma.ticket_messages.create({
      data: {
        ticket_id: primary.id,
        user_id: user.id,
        message: `Merged ${secondaries.length} ticket(s) into this ticket: ${secondaries.map((t) => t.ticket_number).join(', ')}`,
        message_type: 'system',
        is_staff_reply: true,
        is_internal: true,
        sender_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        sender_email: user.email,
      },
    });

    await this.invalidateCache();
    return { message: `Successfully merged ${secondaries.length} ticket(s) into ${primary.ticket_number}`, primary_ticket: primary };
  }

  async remove(id: number) {
    await this.findRaw(id);
    await this.prisma.ticket_messages.deleteMany({ where: { ticket_id: id } });
    await this.prisma.tickets.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Ticket deleted successfully' };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async findRaw(id: number) {
    const ticket = await this.prisma.tickets.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found' });
    return ticket;
  }

  private async markCustomerMessagesRead(ticketId: number) {
    await this.prisma.ticket_messages.updateMany({
      where: { ticket_id: ticketId, is_staff_reply: false, read_at: null },
      data: { read_at: new Date() },
    });
  }

  private async notifyAdminsOfNewTicket(
    ticket: { id: number; ticket_number: string; subject: string; status: string; priority: string; category: string },
    _reqUser: Profile | undefined,
    subject: string,
    category: string,
    priority: string,
  ) {
    try {
      const admins = await this.prisma.profiles.findMany({
        where: { role: { in: ['admin', 'manager'] } },
        select: { id: true },
      });
      for (const admin of admins) {
        await this.createNotification({
          user_id: admin.id,
          title: `New Ticket: ${ticket.ticket_number}`,
          message: `${subject} — ${category} (${priority})`,
          source: 'ticket',
          metadata: JSON.stringify({ ticket_id: ticket.id, ticket_number: ticket.ticket_number }),
        });
      }
    } catch {
      // non-fatal
    }
  }

  private async createNotification(data: { user_id?: number | null; title: string; message: string; source: string; metadata?: string }) {
    try {
      if (!data.user_id) return;
      await this.prisma.notifications.create({
        data: {
          user_id: data.user_id,
          title: data.title,
          message: data.message,
          source: data.source,
          metadata: data.metadata,
        },
      });
    } catch {
      // non-fatal
    }
  }
}
