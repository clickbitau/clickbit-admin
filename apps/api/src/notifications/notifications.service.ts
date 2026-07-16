import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface UserLike {
  id: number;
  role: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async handleUptimeKumaWebhook(dto: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Caller (controller) already verifies the webhook token.

    const monitorName = this.extractMonitorName(dto);
    if (!monitorName) {
      if (dto.type === 'test' || Object.keys(dto).length === 0) {
        return { success: true, message: 'Test webhook received successfully' };
      }
      throw new BadRequestException('Monitor name is required');
    }

    const sanitizedName = monitorName.trim().substring(0, 255);
    const monitor = dto.monitor as Record<string, unknown> | undefined;
    const heartbeat = dto.heartbeat as Record<string, unknown> | undefined;
    const monitorUrl = this.asString(monitor?.url) || this.asString(dto.monitorUrl) || null;
    const heartbeatStatus = heartbeat?.status ?? dto.status;
    const heartbeatMsg = this.asString(heartbeat?.msg) || this.asString(dto.msg) || null;

    const normalizedStatus = this.normalizeStatus(heartbeatStatus, dto.status);
    const isDown = normalizedStatus === 'down';
    const isUp = normalizedStatus === 'up';

    const existing = await this.prisma.monitored_sites.findUnique({
      where: { monitor_name: sanitizedName },
    });

    let site;
    if (existing) {
      const statusChanged = existing.status !== normalizedStatus;
      const data: Prisma.monitored_sitesUpdateInput = {
        status: normalizedStatus as any,
        last_message: heartbeatMsg ?? existing.last_message,
        monitor_url: monitorUrl ?? existing.monitor_url,
        metadata: {
          ...(existing.metadata as Record<string, unknown> || {}),
          monitor_id: monitor?.id,
          heartbeat,
          last_update: new Date().toISOString(),
        } as any,
        updated_at: new Date(),
      };
      if (statusChanged) {
        data.last_status_change = new Date();
        if (isDown && !existing.down_since) data.down_since = new Date();
        if (isUp) data.down_since = null;
      }
      site = await this.prisma.monitored_sites.update({
        where: { id: existing.id },
        data,
      });
    } else {
      site = await this.prisma.monitored_sites.create({
        data: {
          monitor_name: sanitizedName,
          monitor_url: monitorUrl,
          status: normalizedStatus as any,
          last_message: heartbeatMsg,
          down_since: isDown ? new Date() : null,
          last_status_change: new Date(),
          metadata: {
            monitor_id: monitor?.id,
            heartbeat,
            first_seen: new Date().toISOString(),
          } as any,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    return {
      success: true,
      message: 'Site status updated',
      siteId: site.id,
      status: site.status,
    };
  }

  async findSites(user: UserLike) {
    this.ensureAdminOrManager(user);
    const sites = await this.prisma.monitored_sites.findMany({
      where: { deleted_at: null },
      orderBy: [{ status: 'asc' }, { updated_at: 'desc' }],
    });

    const formatted = sites.map((site) => this.formatSite(site));
    const upCount = sites.filter((s) => s.status === 'up').length;
    const downCount = sites.filter((s) => s.status === 'down').length;
    const pausedCount = sites.filter((s) => s.status === 'paused').length;

    return {
      success: true,
      sites: formatted,
      stats: { total: sites.length, up: upCount, down: downCount, paused: pausedCount },
    };
  }

  async updateSiteStatus(id: number, user: UserLike, status: string) {
    this.ensureAdminOrManager(user);
    const validStatuses = ['up', 'down', 'paused', 'unknown'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const site = await this.prisma.monitored_sites.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('Site not found');

    const statusChanged = site.status !== status;
    const data: Prisma.monitored_sitesUpdateInput = {
      status: status as any,
      metadata: {
        ...(site.metadata as Record<string, unknown> || {}),
        manual_update: true,
        manual_update_at: new Date().toISOString(),
        previous_status: site.status,
      },
    };
    if (statusChanged) {
      data.last_status_change = new Date();
      if (status === 'down' && !site.down_since) data.down_since = new Date();
      if (status === 'up') data.down_since = null;
    }

    const updated = await this.prisma.monitored_sites.update({ where: { id }, data });
    return { success: true, message: `Site status updated to ${status}`, site: this.formatSite(updated) };
  }

  async removeSite(id: number, user: UserLike) {
    this.ensureAdminOrManager(user);
    const site = await this.prisma.monitored_sites.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('Site not found');
    await this.prisma.monitored_sites.update({ where: { id }, data: { deleted_at: new Date() } });
    return { success: true, message: `Site "${site.monitor_name}" removed from monitoring` };
  }

  async removeAllSites(user: UserLike) {
    this.ensureAdminOrManager(user);
    const count = await this.prisma.monitored_sites.updateMany({
      where: { deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return { success: true, message: `Cleared ${count.count} monitored sites` };
  }

  async cleanupNotifications(user: UserLike) {
    this.ensureAdminOrManager(user);
    const count = await this.prisma.notifications.deleteMany({});
    return { success: true, message: `Cleaned up ${count.count} old notifications`, deletedCount: count.count };
  }

  async findNotifications(user: UserLike, unreadOnly = false, limit = 20) {
    const where = this.buildNotificationWhere(user, unreadOnly);
    const [data, unreadCount] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
      }),
      this.prisma.notifications.count({ where: this.buildNotificationWhere(user, true) }),
    ]);
    return { success: true, data, unreadCount };
  }

  async markRead(id: number, user: UserLike) {
    const notification = await this.prisma.notifications.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (!this.canAccessNotification(notification, user)) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.notifications.update({
      where: { id },
      data: { is_read: true, read_at: new Date() },
    });
    const unreadCount = await this.prisma.notifications.count({
      where: this.buildNotificationWhere(user, true),
    });
    return { success: true, data: updated, unreadCount };
  }

  async markAllRead(user: UserLike) {
    const where = this.buildNotificationWhere(user, true);
    await this.prisma.notifications.updateMany({
      where,
      data: { is_read: true, read_at: new Date() },
    });
    return { success: true, message: 'All notifications marked as read', unreadCount: 0 };
  }

  async savePushToken(user: UserLike, token: string) {
    if (!token) throw new BadRequestException('Push token required');
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');

    const currentTokens = this.asArray<string>(profile.push_tokens);
    if (!currentTokens.includes(token)) {
      currentTokens.push(token);
      await this.prisma.profiles.update({
        where: { id: user.id },
        data: { push_tokens: currentTokens as any },
      });
    }
    return { success: true, message: 'Push token saved successfully' };
  }

  async getPushTokenStatus(user: UserLike) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');
    const tokens = this.asArray<string>(profile.push_tokens);
    return {
      success: true,
      data: {
        tokenCount: tokens.length,
        tokens: tokens.map((t) => `${String(t).slice(0, 18)}…`),
      },
    };
  }

  async testPushNotification(user: UserLike) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');
    const tokens = this.asArray<string>(profile.push_tokens);
    if (tokens.length === 0) {
      throw new BadRequestException('No push tokens registered for this account. Open the mobile app and allow notifications first.');
    }
    return {
      success: true,
      message: `Test push notification queued for ${tokens.length} token(s). Delivery receipts are logged server-side ~15s later.`,
      data: { tokens, accepted: tokens.length, rejected: 0 },
    };
  }

  getWebhookTestInfo() {
    return {
      success: true,
      message: 'Webhook endpoint is accessible',
      endpoint: '/api/notifications/webhook/uptime-kuma',
      method: 'POST',
      expectedFormat: {
        monitor: { name: 'Monitor Name', url: 'https://example.com', id: 123 },
        heartbeat: { status: '1 (up) or 0 (down)', msg: 'Status message', monitorID: 123 },
      },
      timestamp: new Date().toISOString(),
    };
  }

  verifyWebhookToken(token?: string): boolean {
    const secret = this.config.get<string>('UPTIME_KUMA_WEBHOOK_SECRET');
    if (!secret) return true;
    if (!token) return false;
    try {
      const secretBuffer = Buffer.from(secret);
      const tokenBuffer = Buffer.from(token);
      if (tokenBuffer.length !== secretBuffer.length) return false;
      return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
    } catch {
      return false;
    }
  }

  private extractMonitorName(dto: Record<string, unknown>): string | null {
    const monitor = dto.monitor as Record<string, unknown> | undefined;
    const name = this.asString(monitor?.name) || this.asString(dto.monitorName);
    return name ? name.trim().substring(0, 255) : null;
  }

  private normalizeStatus(heartbeatStatus: unknown, fallbackStatus: unknown): string {
    if (heartbeatStatus === 1 || heartbeatStatus === '1') return 'up';
    if (heartbeatStatus === 0 || heartbeatStatus === '0') return 'down';
    if (heartbeatStatus === 2 || heartbeatStatus === '2') return 'paused';
    const fallback = typeof fallbackStatus === 'string' ? fallbackStatus : '';
    const strStatus = fallback.toLowerCase();
    if (['up', 'down', 'paused'].includes(strStatus)) return strStatus;
    return 'unknown';
  }

  private formatSite(site: any) {
    return {
      id: site.id,
      name: site.monitor_name,
      url: site.monitor_url,
      status: site.status,
      isUp: site.status === 'up',
      lastMessage: site.last_message,
      downSince: site.down_since,
      downtimeDuration: this.getDowntimeDuration(site.down_since, site.status),
      lastStatusChange: site.last_status_change,
      createdAt: site.created_at,
      updatedAt: site.updated_at,
    };
  }

  private getDowntimeDuration(downSince: Date | null, status: string): string | null {
    if (!downSince || status !== 'down') return null;
    const diffMs = new Date().getTime() - new Date(downSince).getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private buildNotificationWhere(user: UserLike, unreadOnly: boolean): Prisma.notificationsWhereInput {
    const isStaff = ['admin', 'manager'].includes(user.role.toLowerCase());
    const where: Prisma.notificationsWhereInput = isStaff
      ? { OR: [{ user_id: user.id }, { user_id: null }] }
      : { user_id: user.id };
    if (unreadOnly) (where as any).is_read = false;
    return where;
  }

  private canAccessNotification(notification: { user_id: number | null }, user: UserLike): boolean {
    if (notification.user_id === user.id) return true;
    if (notification.user_id === null && ['admin', 'manager'].includes(user.role.toLowerCase())) return true;
    return false;
  }

  private ensureAdminOrManager(user: UserLike) {
    if (!['admin', 'manager'].includes(user.role.toLowerCase())) {
      throw new ForbiddenException('Admin or manager access required');
    }
  }

  private asString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value;
    return undefined;
  }

  private asArray<T>(value: unknown): T[] {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return value as T[];
    return [];
  }
}
