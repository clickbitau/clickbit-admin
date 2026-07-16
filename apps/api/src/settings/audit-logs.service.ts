import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { stringValue } from './settings-utils';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(query: Record<string, unknown>) {
    const from = query.from ? new Date(stringValue(query.from)) : undefined;
    const to = query.to ? new Date(stringValue(query.to)) : undefined;
    const entityType = stringValue(query.entity_type);
    const where: any = {};
    if (from || to) where.event_time = {};
    if (from) where.event_time.gte = from;
    if (to) where.event_time.lte = to;
    if (entityType) where.resource_type = entityType;
    const grouped = await this.prisma.audit_logs.groupBy({ by: ['resource_type'], where, _count: { id: true }, _max: { event_time: true } });
    return { success: true, data: grouped.map((g: any) => ({ entity_type: g.resource_type, count: g._count.id, last_activity: g._max.event_time })) };
  }

  async findAll(query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 50));
    const offset = (page - 1) * limit;
    const entityType = stringValue(query.entity_type);
    const action = stringValue(query.action);
    const userId = Number(query.user_id) || undefined;
    const from = query.from ? new Date(stringValue(query.from)) : undefined;
    const to = query.to ? new Date(stringValue(query.to)) : undefined;
    const search = stringValue(query.search);

    const where: any = {};
    if (entityType) where.resource_type = entityType;
    if (action) where.action = { in: action.split(',') };
    if (userId) where.actor_id = userId;
    if (from || to) where.event_time = {};
    if (from) where.event_time.gte = from;
    if (to) where.event_time.lte = to;
    if (search) where.OR = [{ resource_type: { contains: search, mode: 'insensitive' } }, { action: { contains: search, mode: 'insensitive' } }];

    const [total, logs] = await this.prisma.$transaction([
      this.prisma.audit_logs.count({ where }),
      this.prisma.audit_logs.findMany({ where, orderBy: { event_time: 'desc' }, skip: offset, take: limit }),
    ]);
    return { success: true, data: logs.map((log) => this.mapLog(log)), pagination: { total, page, pages: Math.ceil(total / limit), limit } };
  }

  async findByEntity(type: string, id: string, query: Record<string, unknown>) {
    const limit = Number(query.limit) || 50;
    const logs = await this.prisma.audit_logs.findMany({ where: { resource_type: type, resource_id: String(id) }, orderBy: { event_time: 'desc' }, take: limit });
    return { success: true, data: logs.map((log) => this.mapLog(log)) };
  }

  async findByUser(userId: number, query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 50);
    const offset = (page - 1) * limit;
    const from = query.from ? new Date(stringValue(query.from)) : undefined;
    const to = query.to ? new Date(stringValue(query.to)) : undefined;
    const where: any = { actor_id: userId };
    if (from || to) where.event_time = {};
    if (from) where.event_time.gte = from;
    if (to) where.event_time.lte = to;
    const [total, logs] = await this.prisma.$transaction([
      this.prisma.audit_logs.count({ where }),
      this.prisma.audit_logs.findMany({ where, orderBy: { event_time: 'desc' }, skip: offset, take: limit }),
    ]);
    return { success: true, data: logs.map((log) => this.mapLog(log)), pagination: { total, page, pages: Math.ceil(total / limit), limit } };
  }

  async restorable(query: Record<string, unknown>) {
    const limit = Number(query.limit) || 100;
    const entityType = stringValue(query.entity_type);
    const where: any = { action: { in: ['delete', 'archive'] } };
    if (entityType) where.resource_type = entityType;
    const logs = await this.prisma.audit_logs.findMany({ where, orderBy: { event_time: 'desc' }, take: limit });
    return { success: true, data: logs.map((log) => this.mapLog(log)) };
  }

  async findOne(id: string) {
    const logs = await this.prisma.audit_logs.findMany({ where: { id: BigInt(id) }, take: 1 });
    if (!logs.length) return { success: false, message: 'Audit log not found' };
    return { success: true, data: this.mapLog(logs[0]) };
  }

  async export(query: Record<string, unknown>) {
    const from = query.from ? new Date(stringValue(query.from)) : undefined;
    const to = query.to ? new Date(stringValue(query.to)) : undefined;
    const entityType = stringValue(query.entity_type);
    const limit = Number(query.limit) || 1000;
    const where: any = {};
    if (from || to) where.event_time = {};
    if (from) where.event_time.gte = from;
    if (to) where.event_time.lte = to;
    if (entityType) where.resource_type = entityType;
    const logs = await this.prisma.audit_logs.findMany({ where, orderBy: { event_time: 'desc' }, take: limit });
    const headers = ['ID', 'Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Entity Name', 'Profile', 'Profile Role', 'Description', 'IP Address'];
    const rows = logs.map((log) => [String(log.id), String(log.event_time), log.action, log.resource_type, log.resource_id, '', '', '', '', log.ip_address || '']);
    return [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
  }

  private mapLog(log: any) {
    return { id: String(log.id), event_time: log.event_time, created_at: log.created_at, action: log.action, entity_type: log.resource_type, entity_id: log.resource_id, actor_id: log.actor_id, actor_type: log.actor_type, changes: log.changes, previous_state: log.previous_state, ip_address: log.ip_address, metadata: log.metadata };
  }
}
