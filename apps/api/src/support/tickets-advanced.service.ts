import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { PrismaService } from '../prisma/prisma.service';

function toNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Decimal) return value.toNumber();
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function toNum0(value: unknown): number {
  return toNum(value) ?? 0;
}

function cleanIds(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
}

@Injectable()
export class TicketsAdvancedService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureTicket(id: number) {
    const ticket = await this.prisma.tickets.findUnique({ where: { id, deleted_at: null } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  private paginate(query: any) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    return { page, limit, skip: (page - 1) * limit };
  }

  // -------------------------------------------------------------------------
  // Watchers
  // -------------------------------------------------------------------------
  async getWatchers(ticketId: number) {
    await this.ensureTicket(ticketId);
    const rows = await this.prisma.ticket_watchers.findMany({
      where: { ticket_id: ticketId },
      include: { profiles: true },
    });
    return { success: true, data: rows };
  }

  async addWatcher(ticketId: number, body: any, userId: number) {
    await this.ensureTicket(ticketId);
    const watcherUserId = body.user_id ? Number(body.user_id) : userId;
    const existing = await this.prisma.ticket_watchers.findUnique({
      where: { ticket_id_user_id: { ticket_id: ticketId, user_id: watcherUserId } },
    });
    if (existing) return { success: true, data: existing, message: 'Already watching' };
    const row = await this.prisma.ticket_watchers.create({
      data: {
        ticket_id: ticketId,
        user_id: watcherUserId,
        notify_on_reply: body.notify_on_reply ?? true,
        notify_on_status_change: body.notify_on_status_change ?? true,
        notify_on_assignment: body.notify_on_assignment ?? false,
      } as any,
    });
    return { success: true, data: row, message: 'Watcher added' };
  }

  async removeWatcher(ticketId: number, watcherUserId: number) {
    await this.ensureTicket(ticketId);
    await this.prisma.ticket_watchers.deleteMany({ where: { ticket_id: ticketId, user_id: watcherUserId } });
    return { success: true, message: 'Watcher removed' };
  }

  async watch(ticketId: number, userId: number, body: any) {
    return this.addWatcher(ticketId, { user_id: userId, ...body }, userId);
  }

  // -------------------------------------------------------------------------
  // Links
  // -------------------------------------------------------------------------
  async getLinks(ticketId: number) {
    await this.ensureTicket(ticketId);
    const rows = await this.prisma.ticket_links.findMany({
      where: { OR: [{ source_ticket_id: ticketId }, { target_ticket_id: ticketId }] },
      include: { tickets_ticket_links_source_ticket_idTotickets: true, tickets_ticket_links_target_ticket_idTotickets: true },
    });
    return { success: true, data: rows };
  }

  async addLink(ticketId: number, body: any, userId: number) {
    await this.ensureTicket(ticketId);
    const targetId = Number(body.target_ticket_id);
    await this.ensureTicket(targetId);
    const row = await this.prisma.ticket_links.create({
      data: {
        source_ticket_id: ticketId,
        target_ticket_id: targetId,
        link_type: body.link_type || 'related',
        notes: body.notes,
        created_by: userId,
      } as any,
    });
    return { success: true, data: row };
  }

  async removeLink(ticketId: number, linkId: number) {
    await this.ensureTicket(ticketId);
    const link = await this.prisma.ticket_links.findFirst({ where: { id: linkId, OR: [{ source_ticket_id: ticketId }, { target_ticket_id: ticketId }] } });
    if (!link) throw new NotFoundException('Link not found');
    await this.prisma.ticket_links.delete({ where: { id: linkId } });
    return { success: true, message: 'Link removed' };
  }

  linkTypes() {
    return { success: true, data: ['related', 'duplicates', 'blocks', 'blocked_by', 'parent', 'child'] };
  }

  // -------------------------------------------------------------------------
  // Audit log
  // -------------------------------------------------------------------------
  async auditLog(ticketId: number, query: any) {
    await this.ensureTicket(ticketId);
    const { page, limit, skip } = this.paginate(query);
    const [rows, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where: { resource_type: 'tickets', resource_id: String(ticketId) },
        orderBy: { event_time: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.audit_logs.count({ where: { resource_type: 'tickets', resource_id: String(ticketId) } }),
    ]);
    return {
      success: true,
      data: rows,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit },
    };
  }

  // -------------------------------------------------------------------------
  // SLA policies
  // -------------------------------------------------------------------------
  async listSlaPolicies() {
    const rows = await this.prisma.ticket_sla_policies.findMany({ where: { is_active: true }, orderBy: { priority: 'desc' } });
    return { success: true, data: rows };
  }

  async createSlaPolicy(body: any, userId: number) {
    const row = await this.prisma.ticket_sla_policies.create({
      data: {
        name: body.name,
        description: body.description,
        priority: Number(body.priority ?? 0),
        conditions: body.conditions ?? {},
        first_response_hours: toNum(body.first_response_hours) ?? 0,
        resolution_hours: toNum(body.resolution_hours) ?? 0,
        next_response_hours: toNum(body.next_response_hours) ?? 0,
        business_hours_only: body.business_hours_only ?? true,
        business_hours_start: body.business_hours_start,
        business_hours_end: body.business_hours_end,
        business_days: body.business_days ?? [1, 2, 3, 4, 5],
        timezone: body.timezone || 'Australia/Sydney',
        warning_threshold_percent: Number(body.warning_threshold_percent ?? 75),
        escalation_enabled: body.escalation_enabled ?? false,
        escalation_user_id: body.escalation_user_id ? Number(body.escalation_user_id) : null,
        notify_on_warning: body.notify_on_warning ?? true,
        notify_on_breach: body.notify_on_breach ?? true,
        created_by: userId,
      } as any,
    });
    return { success: true, data: row };
  }

  async updateSlaPolicy(id: number, body: any) {
    const existing = await this.prisma.ticket_sla_policies.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA policy not found');
    const data: any = {};
    const fields = ['name', 'description', 'priority', 'conditions', 'first_response_hours', 'resolution_hours', 'next_response_hours', 'business_hours_only', 'business_hours_start', 'business_hours_end', 'business_days', 'timezone', 'warning_threshold_percent', 'escalation_enabled', 'escalation_user_id', 'notify_on_warning', 'notify_on_breach', 'is_active'];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    const row = await this.prisma.ticket_sla_policies.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async deleteSlaPolicy(id: number) {
    const existing = await this.prisma.ticket_sla_policies.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA policy not found');
    await this.prisma.ticket_sla_policies.update({ where: { id }, data: { is_active: false } });
    return { success: true, message: 'SLA policy deactivated' };
  }

  slaDefaults() {
    return {
      success: true,
      data: [
        {
          name: 'Billing Tickets',
          description: 'Auto-assign billing tickets',
          conditions: { match_all: true, rules: [{ field: 'category', operator: 'equals', value: 'billing' }] },
          action_type: 'add_tag',
          action_value: { tag: 'billing-team' },
          priority: 100,
        },
        {
          name: 'Urgent Tickets Alert',
          description: 'Add urgent tag to urgent priority tickets',
          conditions: { match_all: true, rules: [{ field: 'priority', operator: 'equals', value: 'urgent' }] },
          action_type: 'add_tag',
          action_value: { tag: 'needs-attention' },
          priority: 90,
        },
      ],
    };
  }

  async slaStatus(ticketId: number) {
    const ticket = await this.ensureTicket(ticketId);
    const policy = ticket.sla_policy_id ? await this.prisma.ticket_sla_policies.findUnique({ where: { id: ticket.sla_policy_id } }) : null;
    return {
      success: true,
      data: {
        ticket_id: ticketId,
        sla_policy_id: ticket.sla_policy_id,
        first_response_due: ticket.sla_first_response_due,
        first_response_breached: ticket.sla_first_response_breached,
        resolution_due: ticket.sla_resolution_due,
        resolution_breached: ticket.sla_resolution_breached,
        policy,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Assignment rules
  // -------------------------------------------------------------------------
  private evaluateCondition(ticket: any, condition: any): boolean {
    const { field, operator, value } = condition;
    const ticketValue = ticket[field];
    switch (operator) {
      case 'equals':
        return ticketValue === value;
      case 'not_equals':
        return ticketValue !== value;
      case 'in':
        return Array.isArray(value) && value.includes(ticketValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(ticketValue);
      case 'contains':
        return typeof ticketValue === 'string' && ticketValue.toLowerCase().includes(String(value).toLowerCase());
      case 'not_contains':
        return typeof ticketValue === 'string' && !ticketValue.toLowerCase().includes(String(value).toLowerCase());
      case 'starts_with':
        return typeof ticketValue === 'string' && ticketValue.toLowerCase().startsWith(String(value).toLowerCase());
      case 'ends_with':
        return typeof ticketValue === 'string' && ticketValue.toLowerCase().endsWith(String(value).toLowerCase());
      case 'includes':
        return Array.isArray(ticketValue) && ticketValue.includes(value);
      case 'not_includes':
        return Array.isArray(ticketValue) && !ticketValue.includes(value);
      case 'is_empty':
        return !ticketValue || (Array.isArray(ticketValue) && ticketValue.length === 0);
      case 'is_not_empty':
        return !!ticketValue && (!Array.isArray(ticketValue) || ticketValue.length > 0);
      case 'regex':
        try {
          return new RegExp(value, 'i').test(ticketValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private matchesConditions(conditions: any, ticket: any): boolean {
    if (!conditions) return true;
    const { match_all, rules } = conditions || {};
    if (!rules || !Array.isArray(rules) || rules.length === 0) return true;
    return match_all
      ? rules.every((r: any) => this.evaluateCondition(ticket, r))
      : rules.some((r: any) => this.evaluateCondition(ticket, r));
  }

  private async executeRuleAction(rule: any, ticket: any, apply = true) {
    const ticketId = ticket.id;
    const updates: any = {};
    let actionDescription = '';

    switch (rule.action_type) {
      case 'assign_user':
        if (rule.assign_to_user_id) {
          updates.assigned_to = rule.assign_to_user_id;
          actionDescription = `Assigned to user ${rule.assign_to_user_id}`;
        }
        break;

      case 'assign_round_robin': {
        const rrUsers = Array.isArray(rule.round_robin_users) ? rule.round_robin_users : [];
        if (rrUsers.length > 0) {
          const index = (rule.round_robin_index ?? 0) % rrUsers.length;
          updates.assigned_to = rrUsers[index];
          if (apply) {
            await this.prisma.ticket_assignment_rules.update({
              where: { id: rule.id },
              data: { round_robin_index: ((rule.round_robin_index ?? 0) + 1) % rrUsers.length } as any,
            });
          }
          actionDescription = `Round robin assigned to user ${updates.assigned_to}`;
        }
        break;
      }

      case 'assign_least_busy': {
        const users = Array.isArray(rule.round_robin_users) ? rule.round_robin_users : [];
        if (users.length > 0) {
          const counts = await Promise.all(
            users.map(async (userId: number) => ({
              userId,
              count: await this.prisma.tickets.count({
                where: {
                  assigned_to: userId,
                  status: { in: ['open', 'in_progress', 'waiting_customer', 'waiting_staff'] },
                  deleted_at: null,
                } as any,
              }),
            })),
          );
          const least = counts.reduce((min, curr) => (curr.count < min.count ? curr : min), counts[0]);
          updates.assigned_to = least.userId;
          actionDescription = `Assigned to least busy user ${least.userId} (${least.count} tickets)`;
        }
        break;
      }

      case 'add_tag': {
        const tag = rule.action_value?.tag;
        if (tag) {
          const current = await this.prisma.tickets.findUnique({ where: { id: ticketId }, select: { tags: true } });
          const currentTags = Array.isArray(current?.tags) ? (current.tags as any[]) : [];
          if (!currentTags.includes(tag)) {
            updates.tags = [...currentTags, tag];
            actionDescription = `Added tag "${tag}"`;
          }
        }
        break;
      }

      case 'set_priority': {
        const priority = rule.action_value?.priority;
        if (priority) {
          updates.priority = priority;
          actionDescription = `Set priority to "${priority}"`;
        }
        break;
      }

      case 'add_watcher': {
        const userId = rule.action_value?.user_id;
        if (userId) {
          if (apply) {
            await this.prisma.ticket_watchers.upsert({
              where: { ticket_id_user_id: { ticket_id: ticketId, user_id: Number(userId) } },
              create: { ticket_id: ticketId, user_id: Number(userId), notify_on_reply: true, notify_on_status_change: true } as any,
              update: {} as any,
            });
          }
          actionDescription = `Added watcher user ${userId}`;
        }
        break;
      }
    }

    if (apply && Object.keys(updates).length > 0) {
      await this.prisma.tickets.update({ where: { id: ticketId }, data: updates });
    }

    return { updates, actionDescription };
  }

  async processTicket(ticketId: number, triggerType = 'create') {
    const ticket = await this.ensureTicket(ticketId);
    const rules = await this.prisma.ticket_assignment_rules.findMany({
      where: { is_active: true, trigger_on: { in: [triggerType, 'both'] } as any },
      orderBy: { priority: 'desc' },
    });
    const applied: { rule: string; actionDescription: string; rule_id: number }[] = [];

    for (const rule of rules) {
      if (this.matchesConditions(rule.conditions, ticket)) {
        const { actionDescription } = await this.executeRuleAction(rule, ticket, true);
        applied.push({ rule: rule.name, actionDescription, rule_id: rule.id });
        await this.prisma.ticket_assignment_rules.update({
          where: { id: rule.id },
          data: { times_triggered: { increment: 1 }, last_triggered_at: new Date() } as any,
        });
        if (rule.stop_processing) break;
      }
    }

    return { success: true, data: applied };
  }

  async listAssignmentRules() {
    const rows = await this.prisma.ticket_assignment_rules.findMany({ orderBy: { priority: 'desc' } });
    return { success: true, data: rows };
  }

  async createAssignmentRule(body: any, userId: number) {
    const row = await this.prisma.ticket_assignment_rules.create({
      data: {
        name: body.name,
        description: body.description,
        is_active: body.is_active ?? true,
        priority: Number(body.priority ?? 0),
        conditions: body.conditions ?? { match_all: true, rules: [] },
        action_type: body.action_type || 'assign_user',
        action_value: body.action_value ?? null,
        assign_to_user_id: body.assign_to_user_id ? Number(body.assign_to_user_id) : null,
        round_robin_users: body.round_robin_users ?? [],
        round_robin_index: Number(body.round_robin_index ?? 0),
        stop_processing: body.stop_processing ?? true,
        apply_to_existing: body.apply_to_existing ?? false,
        trigger_on: body.trigger_on || 'create',
        created_by: userId,
      } as any,
    });
    return { success: true, data: row };
  }

  async updateAssignmentRule(id: number, body: any) {
    const existing = await this.prisma.ticket_assignment_rules.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Assignment rule not found');
    const data: any = {};
    const fields = [
      'name',
      'description',
      'is_active',
      'priority',
      'conditions',
      'action_type',
      'action_value',
      'assign_to_user_id',
      'round_robin_users',
      'round_robin_index',
      'stop_processing',
      'apply_to_existing',
      'trigger_on',
    ];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
    const row = await this.prisma.ticket_assignment_rules.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async deleteAssignmentRule(id: number) {
    const existing = await this.prisma.ticket_assignment_rules.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Assignment rule not found');
    await this.prisma.ticket_assignment_rules.delete({ where: { id } });
    return { success: true, message: 'Assignment rule deleted' };
  }

  async testAssignmentRule(body: any) {
    const ticketId = Number(body.ticket_id);
    if (!ticketId) throw new BadRequestException('ticket_id is required');
    await this.ensureTicket(ticketId);
    const ruleId = body.rule_id ? Number(body.rule_id) : null;
    if (ruleId) {
      const rule = await this.prisma.ticket_assignment_rules.findUnique({ where: { id: ruleId } });
      if (!rule) throw new NotFoundException('Rule not found');
      const ticket = await this.prisma.tickets.findUnique({ where: { id: ticketId } });
      const matches = this.matchesConditions(rule.conditions, ticket);
      return { success: true, data: { matches, rule: rule.name } };
    }
    const result = await this.processTicket(ticketId, body.trigger_on || 'create');
    return { success: true, data: result.data };
  }

  // -------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------
  async listWebhooks() {
    const rows = await this.prisma.ticket_webhooks.findMany({ orderBy: { created_at: 'desc' } });
    const masked = rows.map((wh) => ({ ...wh, secret: wh.secret ? '••••••••' : null }));
    return { success: true, data: masked };
  }

  async createWebhook(body: any, userId: number) {
    const row = await this.prisma.ticket_webhooks.create({
      data: {
        name: body.name,
        description: body.description,
        url: body.url,
        secret: body.secret,
        events: body.events ?? ['ticket.created'],
        headers: body.headers ?? {},
        payload_template: body.payload_template,
        conditions: body.conditions ?? {},
        retry_count: Number(body.retry_count ?? 3),
        retry_delay_seconds: Number(body.retry_delay_seconds ?? 60),
        timeout_seconds: Number(body.timeout_seconds ?? 30),
        created_by: userId,
      } as any,
    });
    return { success: true, data: row };
  }

  async updateWebhook(id: number, body: any) {
    const existing = await this.prisma.ticket_webhooks.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webhook not found');
    const data: any = {};
    const fields = ['name', 'description', 'url', 'secret', 'is_active', 'events', 'headers', 'payload_template', 'conditions', 'retry_count', 'retry_delay_seconds', 'timeout_seconds'];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
    const row = await this.prisma.ticket_webhooks.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async deleteWebhook(id: number) {
    const existing = await this.prisma.ticket_webhooks.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webhook not found');
    await this.prisma.ticket_webhooks.delete({ where: { id } });
    return { success: true, message: 'Webhook deleted' };
  }

  async testWebhook(id: number) {
    const webhook = await this.prisma.ticket_webhooks.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    if (!webhook.url) throw new BadRequestException('Webhook URL is missing');

    const payload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      ticket: {
        id: 0,
        ticket_number: 'TKT-TEST',
        subject: 'Test Webhook Delivery',
        status: 'open',
        priority: 'medium',
        category: 'general',
        contact_email: 'test@example.com',
        tags: ['test'],
        created_at: new Date(),
        updated_at: new Date(),
      },
      test: true,
    };

    const body = JSON.stringify(payload);
    const signature = webhook.secret ? crypto.createHmac('sha256', webhook.secret).update(body).digest('hex') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'TicketSystem-Webhook/1.0',
      'X-Webhook-Event': 'test',
      'X-Webhook-Delivery': `${webhook.id}-${Date.now()}`,
      ...(webhook.headers && typeof webhook.headers === 'object' ? (webhook.headers as Record<string, string>) : {}),
      ...(signature ? { 'X-Webhook-Signature': `sha256=${signature}` } : {}),
    };

    const startTime = Date.now();
    const result = await this.sendHttpRequest(webhook.url, 'POST', headers, body, (webhook.timeout_seconds ?? 30) * 1000);
    const responseTime = Date.now() - startTime;
    const success = result.status !== undefined && result.status >= 200 && result.status < 300;

    await this.prisma.ticket_webhooks.update({
      where: { id },
      data: {
        last_triggered_at: new Date(),
        last_status_code: result.status ?? null,
        last_error: success ? null : (result.error || result.body || 'Request failed').substring(0, 500),
      },
    });

    return {
      success,
      message: success ? 'Test successful' : 'Test failed',
      status: result.status,
      responseTime,
      body: result.body ? result.body.substring(0, 500) : result.error,
    };
  }

  private sendHttpRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string,
    timeoutMs: number,
  ): Promise<{ status?: number; body?: string; error?: string }> {
    return new Promise((resolve) => {
      try {
        const target = new URL(url);
        const transport = target.protocol === 'https:' ? https : http;
        const req = transport.request(
          {
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: target.pathname + target.search,
            method,
            headers,
            timeout: timeoutMs,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              resolve({ status: res.statusCode, body: data });
            });
          },
        );
        req.on('error', (err) => resolve({ error: err.message }));
        req.on('timeout', () => {
          req.destroy();
          resolve({ error: 'Request timeout' });
        });
        if (body) req.write(body);
        req.end();
      } catch (err: any) {
        resolve({ error: err.message });
      }
    });
  }

  webhookLogs(_id: number, _query: any) {
    return { success: true, data: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 } };
  }

  webhookEvents() {
    return {
      success: true,
      data: [
        'ticket.created',
        'ticket.updated',
        'ticket.deleted',
        'ticket.status_changed',
        'ticket.assigned',
        'ticket.resolved',
        'ticket.closed',
        'ticket.reopened',
        'ticket.sla_warning',
        'ticket.sla_breached',
        'message.created',
        'message.staff_reply',
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Custom fields
  // -------------------------------------------------------------------------
  async listCustomFieldDefinitions(query: any) {
    const { page, limit, skip } = this.paginate(query);
    const where: any = { is_active: true };
    if (query.show_in_list) where.show_in_list = true;
    if (query.show_in_card) where.show_in_card = true;
    const [rows, total] = await Promise.all([
      this.prisma.ticket_custom_field_definitions.findMany({ where, orderBy: { display_order: 'asc' }, take: limit, skip }),
      this.prisma.ticket_custom_field_definitions.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async createCustomFieldDefinition(body: any, userId: number) {
    const row = await this.prisma.ticket_custom_field_definitions.create({
      data: {
        name: body.name,
        label: body.label,
        description: body.description,
        field_type: body.field_type || 'text',
        options: body.options ?? [],
        default_value: body.default_value,
        placeholder: body.placeholder,
        is_required: body.is_required ?? false,
        is_active: body.is_active ?? true,
        is_searchable: body.is_searchable ?? true,
        is_filterable: body.is_filterable ?? true,
        show_in_list: body.show_in_list ?? false,
        show_in_card: body.show_in_card ?? false,
        display_order: Number(body.display_order ?? 0),
        validation_rules: body.validation_rules ?? {},
        applies_to_categories: body.applies_to_categories ?? [],
        created_by: userId,
      } as any,
    });
    return { success: true, data: row };
  }

  async updateCustomFieldDefinition(id: number, body: any) {
    const existing = await this.prisma.ticket_custom_field_definitions.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Custom field not found');
    const data: any = {};
    const fields = ['name', 'label', 'description', 'field_type', 'options', 'default_value', 'placeholder', 'is_required', 'is_active', 'is_searchable', 'is_filterable', 'show_in_list', 'show_in_card', 'display_order', 'validation_rules', 'applies_to_categories'];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
    const row = await this.prisma.ticket_custom_field_definitions.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async deleteCustomFieldDefinition(id: number) {
    const existing = await this.prisma.ticket_custom_field_definitions.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Custom field not found');
    await this.prisma.ticket_custom_field_definitions.update({ where: { id }, data: { is_active: false } });
    return { success: true, message: 'Custom field deactivated' };
  }

  async getTicketCustomFields(ticketId: number) {
    await this.ensureTicket(ticketId);
    const rows = await this.prisma.ticket_custom_field_values.findMany({ where: { ticket_id: ticketId }, include: { ticket_custom_field_definitions: true } });
    return { success: true, data: rows };
  }

  async updateTicketCustomFields(ticketId: number, body: any) {
    await this.ensureTicket(ticketId);
    const values = body.values || body.custom_fields || [];
    for (const item of values) {
      const fieldId = Number(item.field_id ?? item.id);
      const existing = await this.prisma.ticket_custom_field_values.findUnique({
        where: { ticket_id_field_id: { ticket_id: ticketId, field_id: fieldId } },
      });
      const payload: any = {
        value_text: item.value_text,
        value_number: toNum(item.value_number),
        value_boolean: item.value_boolean,
        value_date: item.value_date ? new Date(item.value_date) : null,
        value_json: item.value_json,
        value_reference_id: item.value_reference_id ? Number(item.value_reference_id) : null,
      };
      if (existing) {
        await this.prisma.ticket_custom_field_values.update({
          where: { ticket_id_field_id: { ticket_id: ticketId, field_id: fieldId } },
          data: payload,
        });
      } else {
        await this.prisma.ticket_custom_field_values.create({
          data: { ticket_id: ticketId, field_id: fieldId, ...payload },
        });
      }
    }
    return this.getTicketCustomFields(ticketId);
  }

  // -------------------------------------------------------------------------
  // Boards
  // -------------------------------------------------------------------------
  async listBoards() {
    const rows = await this.prisma.ticket_boards.findMany({ where: { is_active: true }, orderBy: { created_at: 'desc' } });
    return { success: true, data: rows };
  }

  async getBoard(id: number) {
    const row = await this.prisma.ticket_boards.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Board not found');
    return { success: true, data: row };
  }

  async createBoard(body: any, userId: number) {
    const row = await this.prisma.ticket_boards.create({
      data: {
        name: body.name,
        description: body.description,
        board_type: body.board_type || 'kanban',
        is_default: body.is_default ?? false,
        is_active: body.is_active ?? true,
        filter_query: body.filter_query ?? {},
        columns: body.columns ?? [],
        swimlanes: body.swimlanes ?? [],
        card_fields: body.card_fields ?? ['priority', 'assignee', 'due_date'],
        quick_filters: body.quick_filters ?? [],
        settings: body.settings ?? {},
        created_by: userId,
      } as any,
    });
    return { success: true, data: row };
  }

  async updateBoard(id: number, body: any) {
    const existing = await this.prisma.ticket_boards.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Board not found');
    const data: any = {};
    const fields = ['name', 'description', 'board_type', 'is_default', 'is_active', 'filter_query', 'columns', 'swimlanes', 'card_fields', 'quick_filters', 'settings'];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
    const row = await this.prisma.ticket_boards.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async deleteBoard(id: number) {
    const existing = await this.prisma.ticket_boards.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Board not found');
    await this.prisma.ticket_boards.update({ where: { id }, data: { is_active: false } });
    return { success: true, message: 'Board deactivated' };
  }

  async updateBoardSettings(id: number, body: any) {
    return this.updateBoard(id, { settings: body.settings });
  }

  boardDefaults() {
    return {
      success: true,
      data: {
        columns: [
          { id: 'backlog', name: 'Backlog', status: 'backlog' },
          { id: 'open', name: 'Open', status: 'open' },
          { id: 'in_progress', name: 'In Progress', status: 'in_progress' },
          { id: 'waiting_customer', name: 'Waiting Customer', status: 'waiting_customer' },
          { id: 'waiting_staff', name: 'Waiting Staff', status: 'waiting_staff' },
          { id: 'resolved', name: 'Resolved', status: 'resolved' },
          { id: 'closed', name: 'Closed', status: 'closed' },
        ],
        card_fields: ['priority', 'assignee', 'due_date', 'category'],
      },
    };
  }

  async moveTicket(body: any) {
    const ticketId = Number(body.ticket_id);
    const status = body.status;
    const position = Number(body.position ?? 0);
    const ticket = await this.ensureTicket(ticketId);
    await this.prisma.tickets.update({
      where: { id: ticketId },
      data: { status: status || ticket.status, position, updated_at: new Date() } as any,
    });
    return { success: true, message: 'Ticket moved' };
  }

  // -------------------------------------------------------------------------
  // Components
  // -------------------------------------------------------------------------
  async listComponents(query: any) {
    const { page, limit, skip } = this.paginate(query);
    const where: any = { is_active: true };
    const [rows, total] = await Promise.all([
      this.prisma.ticket_components.findMany({ where, orderBy: { display_order: 'asc' }, take: limit, skip }),
      this.prisma.ticket_components.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async createComponent(body: any, userId: number) {
    const row = await this.prisma.ticket_components.create({
      data: {
        name: body.name,
        description: body.description,
        lead_user_id: body.lead_user_id ? Number(body.lead_user_id) : null,
        default_assignee_id: body.default_assignee_id ? Number(body.default_assignee_id) : null,
        color: body.color || '#6366f1',
        icon: body.icon,
        is_active: body.is_active ?? true,
        display_order: Number(body.display_order ?? 0),
        created_by: userId,
      } as any,
    });
    return { success: true, data: row };
  }

  async updateComponent(id: number, body: any) {
    const existing = await this.prisma.ticket_components.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Component not found');
    const data: any = {};
    const fields = ['name', 'description', 'lead_user_id', 'default_assignee_id', 'color', 'icon', 'is_active', 'display_order'];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
    const row = await this.prisma.ticket_components.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async deleteComponent(id: number) {
    const existing = await this.prisma.ticket_components.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Component not found');
    await this.prisma.ticket_components.update({ where: { id }, data: { is_active: false } });
    return { success: true, message: 'Component deactivated' };
  }

  async getTicketComponents(ticketId: number) {
    await this.ensureTicket(ticketId);
    const rows = await this.prisma.ticket_component_assignments.findMany({
      where: { ticket_id: ticketId },
      include: { ticket_components: true },
    });
    return { success: true, data: rows.map((r) => r.ticket_components) };
  }

  async updateTicketComponents(ticketId: number, body: any) {
    await this.ensureTicket(ticketId);
    const componentIds = cleanIds((body.component_ids || body.components || []).map((x: any) => (typeof x === 'number' ? x : x.id)));
    await this.prisma.ticket_component_assignments.deleteMany({ where: { ticket_id: ticketId } });
    if (componentIds.length) {
      await this.prisma.ticket_component_assignments.createMany({
        data: componentIds.map((component_id) => ({ ticket_id: ticketId, component_id })),
      });
    }
    return this.getTicketComponents(ticketId);
  }

  // -------------------------------------------------------------------------
  // Time logs
  // -------------------------------------------------------------------------
  async getTimeLogs(ticketId: number, query: any) {
    await this.ensureTicket(ticketId);
    const { page, limit, skip } = this.paginate(query);
    const where: any = { ticket_id: ticketId };
    if (query.user_id) where.user_id = Number(query.user_id);
    const [rows, total] = await Promise.all([
      this.prisma.ticket_time_logs.findMany({ where, orderBy: { work_date: 'desc' }, take: limit, skip }),
      this.prisma.ticket_time_logs.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async timeSummary(ticketId: number) {
    await this.ensureTicket(ticketId);
    const agg = await this.prisma.ticket_time_logs.aggregate({
      where: { ticket_id: ticketId },
      _sum: { time_spent_minutes: true, billing_rate: true },
    });
    return { success: true, data: { total_minutes: toNum0(agg._sum?.time_spent_minutes), billing_rate_sum: toNum0(agg._sum?.billing_rate) } };
  }

  async createTimeLog(ticketId: number, body: any, userId: number) {
    await this.ensureTicket(ticketId);
    const row = await this.prisma.ticket_time_logs.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        time_spent_minutes: Number(body.time_spent_minutes ?? 0),
        work_date: body.work_date ? new Date(body.work_date) : new Date(),
        started_at: body.started_at ? new Date(body.started_at) : null,
        ended_at: body.ended_at ? new Date(body.ended_at) : null,
        description: body.description,
        work_type: body.work_type || 'support',
        is_billable: body.is_billable ?? true,
        billing_rate: toNum(body.billing_rate) ?? null,
      } as any,
    });
    return { success: true, data: row };
  }

  async updateTimeLog(ticketId: number, logId: number, body: any) {
    await this.ensureTicket(ticketId);
    const existing = await this.prisma.ticket_time_logs.findFirst({ where: { id: logId, ticket_id: ticketId } });
    if (!existing) throw new NotFoundException('Time log not found');
    const data: any = {};
    const fields = ['time_spent_minutes', 'work_date', 'started_at', 'ended_at', 'description', 'work_type', 'is_billable', 'billing_rate'];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
    const row = await this.prisma.ticket_time_logs.update({ where: { id: logId }, data });
    return { success: true, data: row };
  }

  async deleteTimeLog(ticketId: number, logId: number) {
    await this.ensureTicket(ticketId);
    const existing = await this.prisma.ticket_time_logs.findFirst({ where: { id: logId, ticket_id: ticketId } });
    if (!existing) throw new NotFoundException('Time log not found');
    await this.prisma.ticket_time_logs.delete({ where: { id: logId } });
    return { success: true, message: 'Time log deleted' };
  }

  async updateTimeEstimate(ticketId: number, body: any) {
    await this.ensureTicket(ticketId);
    await this.prisma.tickets.update({
      where: { id: ticketId },
      data: { time_estimate_minutes: Number(body.time_estimate_minutes ?? 0), time_remaining_minutes: Number(body.time_remaining_minutes ?? 0) } as any,
    });
    return { success: true, message: 'Time estimate updated' };
  }

  async myTimeLogs(userId: number, query: any) {
    const { page, limit, skip } = this.paginate(query);
    const where: any = { user_id: userId };
    const [rows, total] = await Promise.all([
      this.prisma.ticket_time_logs.findMany({ where, orderBy: { work_date: 'desc' }, take: limit, skip, include: { tickets: true } }),
      this.prisma.ticket_time_logs.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async timeReport(query: any) {
    const where: any = {};
    if (query.user_id) where.user_id = Number(query.user_id);
    if (query.ticket_id) where.ticket_id = Number(query.ticket_id);
    const agg = await this.prisma.ticket_time_logs.aggregate({ where, _sum: { time_spent_minutes: true } });
    return { success: true, data: { total_minutes: toNum0(agg._sum?.time_spent_minutes) } };
  }

  // -------------------------------------------------------------------------
  // Versions
  // -------------------------------------------------------------------------
  async listVersions() {
    const rows = await this.prisma.ticket_versions.findMany({ orderBy: { display_order: 'asc', created_at: 'desc' } });
    return { success: true, data: rows };
  }

  async getVersion(id: number) {
    const row = await this.prisma.ticket_versions.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Version not found');
    return { success: true, data: row };
  }

  async createVersion(body: any, userId: number) {
    const row = await this.prisma.ticket_versions.create({
      data: {
        name: body.name,
        description: body.description,
        version_type: body.version_type || 'release',
        status: body.status || 'planned',
        start_date: body.start_date ? new Date(body.start_date) : null,
        release_date: body.release_date ? new Date(body.release_date) : null,
        release_notes: body.release_notes,
        is_released: body.is_released ?? false,
        display_order: Number(body.display_order ?? 0),
        created_by: userId,
      } as any,
    });
    return { success: true, data: row };
  }

  async updateVersion(id: number, body: any) {
    const existing = await this.prisma.ticket_versions.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Version not found');
    const data: any = {};
    const fields = ['name', 'description', 'version_type', 'status', 'start_date', 'release_date', 'release_notes', 'is_released', 'display_order'];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
    const row = await this.prisma.ticket_versions.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async deleteVersion(id: number) {
    const existing = await this.prisma.ticket_versions.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Version not found');
    await this.prisma.ticket_versions.delete({ where: { id } });
    return { success: true, message: 'Version deleted' };
  }

  async releaseVersion(id: number, body: any) {
    const existing = await this.prisma.ticket_versions.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Version not found');
    const row = await this.prisma.ticket_versions.update({
      where: { id },
      data: { is_released: true, released_at: new Date(), release_notes: body.release_notes || existing.release_notes, status: 'released' } as any,
    });
    return { success: true, data: row };
  }

  async releaseNotes(id: number) {
    const row = await this.getVersion(id);
    return { success: true, data: { release_notes: (row.data as any).release_notes } };
  }

  async unreleasedVersions() {
    const rows = await this.prisma.ticket_versions.findMany({ where: { is_released: false }, orderBy: { release_date: 'asc' } });
    return { success: true, data: rows };
  }

  // -------------------------------------------------------------------------
  // Subtasks
  // -------------------------------------------------------------------------
  async getSubtasks(ticketId: number) {
    await this.ensureTicket(ticketId);
    const rows = await this.prisma.tickets.findMany({ where: { parent_ticket_id: ticketId, deleted_at: null } });
    return { success: true, data: rows };
  }

  async createSubtask(ticketId: number, body: any) {
    const parent = await this.ensureTicket(ticketId);
    const row = await this.prisma.tickets.create({
      data: {
        ticket_number: `ST-${Date.now()}`,
        subject: body.subject,
        description: body.description,
        parent_ticket_id: ticketId,
        status: 'open',
        priority: body.priority || parent.priority,
        category: body.category || parent.category,
        contact_email: parent.contact_email,
        user_id: parent.user_id,
      } as any,
    });
    return { success: true, data: row };
  }

  async convertToSubtask(ticketId: number, body: any) {
    await this.ensureTicket(ticketId);
    const parentId = Number(body.parent_ticket_id);
    await this.ensureTicket(parentId);
    await this.prisma.tickets.update({ where: { id: ticketId }, data: { parent_ticket_id: parentId } as any });
    return { success: true, data: await this.prisma.tickets.findUnique({ where: { id: ticketId } }) };
  }

  async convertToTicket(ticketId: number) {
    await this.ensureTicket(ticketId);
    await this.prisma.tickets.update({ where: { id: ticketId }, data: { parent_ticket_id: null } as any });
    return { success: true, data: await this.prisma.tickets.findUnique({ where: { id: ticketId } }) };
  }
}
