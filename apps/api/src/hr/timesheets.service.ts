import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { buildLegacyDataEnvelope, buildLegacyMessageEnvelope, parseNumber } from './hr-utils';
import { CacheService } from '../redis/cache.service';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function dateAtStartOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateAtEndOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

function mapTimeEntry(entry: any) {
  const employee = entry.employees || entry.employee || {};
  const profile = employee.profiles;
  const shift = entry.hr_shifts || entry.shift || null;
  const workItems = entry.time_entry_work_items || entry.workItems || [];

  const mapped: any = { ...entry };
  mapped.employee = {
    ...employee,
    name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.email || 'Unknown Employee',
    user: profile,
    hourly_rate: profile?.hourly_rate,
  };
  mapped.shift = shift;
  mapped.work_items = Array.isArray(workItems) ? workItems : [];
  mapped.work_items_count = mapped.work_items.length;
  delete mapped.employees;
  delete mapped.hr_shifts;
  delete mapped.time_entry_work_items;
  delete mapped.workItems;
  return mapped;
}

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private async findEmployee(userId: number) {
    return this.prisma.employees.findFirst({ where: { user_id: userId, deleted_at: null } });
  }

  private async canAct(user: Profile, entryEmployeeId: number) {
    if (user.role === 'admin' || user.role === 'manager') return true;
    const employee = await this.findEmployee(user.id);
    return employee ? employee.id === entryEmployeeId : false;
  }

  private async audit(action: string, resourceType: string, resourceId: string | number, user: Profile, previous?: any, changes?: any, req?: any) {
    try {
      await this.prisma.audit_logs.create({
        data: {
          actor_id: user.id,
          actor_type: 'user',
          resource_type: resourceType,
          resource_id: String(resourceId),
          action,
          changes: changes,
          previous_state: previous,
          ip_address: req?.ip || '',
          user_agent: req?.headers?.['user-agent'] || '',
        },
      });
    } catch {
      // ignore audit failures
    }
  }

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('timesheets', ...parts) ?? `timesheets:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private employeeName(employee: any) {
    const p = employee?.profiles || employee?.user;
    return `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || p?.email || 'Unknown Employee';
  }

  async findAll(query: any, user: Profile) {
    const cacheKey = this.cacheKey('list', user.id, user.role, JSON.stringify(query));
    return this.cache?.getOrSet(cacheKey, () => this.fetchFindAll(query, user), this.CACHE_TTL_SECONDS) ?? this.fetchFindAll(query, user);
  }

  private async fetchFindAll(query: any, user: Profile) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query.limit) || 50));
    const offset = (page - 1) * limit;
    const status = query.status ? String(query.status).toLowerCase() : null;

    let targetEmployeeId: number | undefined = query.employee_id ? Number(query.employee_id) : undefined;
    if (user.role !== 'admin' && user.role !== 'manager') {
      const employee = await this.findEmployee(user.id);
      if (!employee) throw new NotFoundException({ success: false, message: 'Employee profile not found' });
      targetEmployeeId = employee.id;
    }

    const where: Prisma.hr_time_entriesWhereInput = {};
    const validStatuses = ['active', 'completed', 'approved', 'rejected', 'edited'];

    if (status === 'pending') {
      (where as any).clock_out_time = { not: null };
      (where as any).approved_by = null;
      where.status = { in: ['completed', 'edited'] };
      if (targetEmployeeId) where.employee_id = targetEmployeeId;
    } else {
      if (targetEmployeeId) where.employee_id = targetEmployeeId;

      const isActiveStatusFilter = status === 'active';
      if (status && validStatuses.includes(status)) {
        if (isActiveStatusFilter) {
          where.status = 'active';
          (where as any).clock_out_time = null;
        } else {
          where.status = status as any;
        }
      }

      const startDate = query.start_date ? dateAtStartOfDay(query.start_date) : undefined;
      const endDate = query.end_date ? dateAtEndOfDay(query.end_date) : undefined;

      if (startDate && endDate) {
        if (isActiveStatusFilter) {
          where.clock_in_time = { gte: startDate, lte: endDate };
        } else {
          (where as any).OR = [
            { clock_in_time: { gte: startDate, lte: endDate } },
            { clock_out_time: null },
          ];
        }
      } else if (startDate) {
        if (isActiveStatusFilter) {
          where.clock_in_time = { gte: startDate };
        } else {
          (where as any).OR = [{ clock_in_time: { gte: startDate } }, { clock_out_time: null }];
        }
      } else if (endDate) {
        if (isActiveStatusFilter) {
          where.clock_in_time = { lte: endDate };
        } else {
          (where as any).OR = [{ clock_in_time: { lte: endDate } }, { clock_out_time: null }];
        }
      }
    }

    const [count, rows] = await this.prisma.$transaction([
      this.prisma.hr_time_entries.count({ where }),
      this.prisma.hr_time_entries.findMany({
        where,
        include: {
          employees: { include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } } } },
          hr_shifts: true,
          time_entry_work_items: { select: { id: true } },
        },
        orderBy: { clock_in_time: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    const data = rows.map(mapTimeEntry);

    let totalMinutes = 0;
    let totalBreakMinutes = 0;
    let totalEstimatedPay = 0;
    for (const entry of data) {
      totalMinutes += entry.total_minutes || 0;
      totalBreakMinutes += entry.break_minutes || 0;
      const hourlyRate = entry.employee?.hourly_rate;
      if (entry.total_minutes && hourlyRate) {
        totalEstimatedPay += (entry.total_minutes / 60) * parseNumber(hourlyRate);
      }
    }

    const pendingWhere: any = {
      clock_out_time: { not: null },
      approved_by: null,
      status: { in: ['completed', 'edited'] },
    };
    if (status !== 'pending') {
      if (query.start_date && query.end_date) {
        pendingWhere.clock_in_time = { gte: dateAtStartOfDay(query.start_date), lte: dateAtEndOfDay(query.end_date) };
      } else if (query.start_date) {
        pendingWhere.clock_in_time = { gte: dateAtStartOfDay(query.start_date) };
      } else if (query.end_date) {
        pendingWhere.clock_in_time = { lte: dateAtEndOfDay(query.end_date) };
      }
    }
    const pendingCount = await this.prisma.hr_time_entries.count({ where: pendingWhere });

    return {
      success: true,
      data,
      summary: {
        totalHours: round2(totalMinutes / 60),
        totalBreakHours: round2(totalBreakMinutes / 60),
        entriesCount: count,
        totalEstimatedPay: round2(totalEstimatedPay),
        pendingApprovals: pendingCount,
      },
      pagination: {
        total: count,
        page,
        pages: count > 0 ? Math.ceil(count / limit) : 1,
        limit,
      },
    };
  }

  async findOne(id: number, user: Profile) {
    const cacheKey = this.cacheKey('detail', user.id, id);
    return this.cache?.getOrSet(cacheKey, () => this.fetchFindOne(id, user), this.CACHE_TTL_SECONDS) ?? this.fetchFindOne(id, user);
  }

  private async fetchFindOne(id: number, user: Profile) {
    const entry = await this.prisma.hr_time_entries.findUnique({
      where: { id },
      include: {
        employees: { include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } } } },
        hr_shifts: true,
        time_entry_work_items: {
          include: { project_tasks: { select: { id: true, title: true, status: true } } },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!entry) throw new NotFoundException({ success: false, message: 'Time entry not found' });

    if (user.role !== 'admin' && user.role !== 'manager') {
      const employee = await this.findEmployee(user.id);
      if (!employee || entry.employee_id !== employee.id) {
        throw new ForbiddenException({ success: false, message: 'Not authorized to view this time entry' });
      }
    }

    const approver = entry.approved_by
      ? await this.prisma.profiles.findUnique({ where: { id: entry.approved_by }, select: { first_name: true, last_name: true } })
      : null;

    const mapped = mapTimeEntry(entry);
    mapped.approved_by_name = approver ? `${approver.first_name || ''} ${approver.last_name || ''}`.trim() : undefined;
    mapped.work_items = mapped.time_entry_work_items || [];
    return buildLegacyDataEnvelope(mapped);
  }

  async summary(employeeId: number, query: any) {
    const startDate = query.start_date ? new Date(query.start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = query.end_date ? new Date(query.end_date) : new Date();
    const entries = await this.prisma.hr_time_entries.findMany({
      where: { employee_id: Number(employeeId), clock_in_time: { gte: startDate, lte: endDate } },
      orderBy: { clock_in_time: 'asc' },
    });

    const summary = {
      totalMinutes: 0,
      totalBreakMinutes: 0,
      totalOvertimeMinutes: 0,
      entriesCount: entries.length,
      daysSummary: {} as Record<string, { minutes: number; entries: number }>,
    };

    for (const entry of entries) {
      summary.totalMinutes += entry.total_minutes || 0;
      summary.totalBreakMinutes += entry.break_minutes || 0;
      summary.totalOvertimeMinutes += entry.overtime_minutes || 0;

      const dayKey = new Date(entry.clock_in_time).toISOString().split('T')[0];
      if (!summary.daysSummary[dayKey]) summary.daysSummary[dayKey] = { minutes: 0, entries: 0 };
      summary.daysSummary[dayKey].minutes += entry.total_minutes || 0;
      summary.daysSummary[dayKey].entries += 1;
    }

    return buildLegacyDataEnvelope({
      ...summary,
      totalHours: round2(summary.totalMinutes / 60),
      totalOvertimeHours: round2(summary.totalOvertimeMinutes / 60),
    });
  }

  async edit(id: number, dto: any, user: Profile, req?: any) {
    const entry = await this.prisma.hr_time_entries.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException({ success: false, message: 'Time entry not found' });

    const isAdmin = ['admin', 'manager'].includes(user.role);
    if (!isAdmin) {
      const employee = await this.findEmployee(user.id);
      if (!employee || entry.employee_id !== employee.id) {
        throw new ForbiddenException({ success: false, message: 'You can only edit your own time entries' });
      }
    }

    const previous = { ...entry };

    if (isAdmin) {
      const updates: Prisma.hr_time_entriesUncheckedUpdateInput = {};
      if (!entry.original_clock_in && entry.clock_in_time) updates.original_clock_in = entry.clock_in_time;
      if (!entry.original_clock_out && entry.clock_out_time) updates.original_clock_out = entry.clock_out_time;
      if (dto.clock_in_time) updates.clock_in_time = new Date(dto.clock_in_time);
      if (dto.clock_out_time) updates.clock_out_time = new Date(dto.clock_out_time);
      if (dto.break_minutes !== undefined) updates.break_minutes = dto.break_minutes;

      if (updates.clock_out_time || entry.clock_out_time) {
        const clockIn = (updates.clock_in_time as Date) || entry.clock_in_time;
        const clockOut = (updates.clock_out_time as Date) || entry.clock_out_time;
        if (clockIn && clockOut) {
          const duration = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000;
          updates.total_minutes = Math.round(duration - ((updates.break_minutes as number) ?? entry.break_minutes ?? 0));
        }
      }

      updates.status = 'edited';
      updates.edited_by = user.id;
      updates.edit_reason = dto.reason;
      updates.admin_notes = `Admin edit by user ${user.id}: ${dto.reason}`;

      const updated = await this.prisma.hr_time_entries.update({ where: { id }, data: updates });
      await this.audit('update', 'hr_time_entry', id, user, previous, updates, req);
      await this.invalidateCache();
      await this.cache?.del(this.cacheKey('detail', user.id, id));
      return { success: true, message: 'Time entry updated', data: updated };
    }

    const proposedChanges: any = {
      ...(dto.clock_in_time && { clock_in_time: new Date(dto.clock_in_time) }),
      ...(dto.clock_out_time && { clock_out_time: new Date(dto.clock_out_time) }),
      ...(dto.break_minutes !== undefined && { break_minutes: dto.break_minutes }),
      reason: dto.reason,
      requested_by: user.id,
      requested_at: new Date().toISOString(),
    };

    const updated = await this.prisma.hr_time_entries.update({
      where: { id },
      data: {
        status: 'edited',
        edited_by: user.id,
        edit_reason: dto.reason,
        admin_notes: JSON.stringify({ proposed_changes: proposedChanges }),
      },
    });

    this.notifyManager(entry.employee_id, 'Timesheet Edit Request', `${this.employeeName(await this.prisma.employees.findFirst({ where: { id: entry.employee_id }, include: { profiles: true } }))} requested a timesheet edit: ${dto.reason?.substring(0, 100)}`, `/admin/hr/timesheets`, { entry_id: id });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', user.id, id));
    return { success: true, message: 'Edit request submitted — pending manager approval', data: updated };
  }

  async approve(id: number, user: Profile, req?: any) {
    const entry = await this.prisma.hr_time_entries.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException({ success: false, message: 'Time entry not found' });

    const previous = { ...entry };
    const updates: Prisma.hr_time_entriesUncheckedUpdateInput = { status: 'approved', approved_by: user.id, approved_at: new Date() };

    if (entry.status === 'edited' && entry.admin_notes) {
      try {
        const notes = JSON.parse(entry.admin_notes);
        if (notes.proposed_changes) {
          const pc = notes.proposed_changes;
          if (!entry.original_clock_in && entry.clock_in_time) updates.original_clock_in = entry.clock_in_time;
          if (!entry.original_clock_out && entry.clock_out_time) updates.original_clock_out = entry.clock_out_time;
          if (pc.clock_in_time) updates.clock_in_time = new Date(pc.clock_in_time);
          if (pc.clock_out_time) updates.clock_out_time = new Date(pc.clock_out_time);
          if (pc.break_minutes !== undefined) updates.break_minutes = pc.break_minutes;

          if (updates.clock_out_time || entry.clock_out_time) {
            const clockIn = (updates.clock_in_time as Date) || entry.clock_in_time;
            const clockOut = (updates.clock_out_time as Date) || entry.clock_out_time;
            if (clockIn && clockOut) {
              const duration = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000;
              updates.total_minutes = Math.round(duration - ((updates.break_minutes as number) ?? entry.break_minutes ?? 0));
            }
          }
          updates.admin_notes = null;
        }
      } catch {
        // ignore malformed admin_notes
      }
    }

    const updated = await this.prisma.hr_time_entries.update({ where: { id }, data: updates });
    await this.audit('approve', 'hr_time_entry', id, user, previous, updates, req);
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', user.id, id));
    return { success: true, message: 'Time entry approved', data: updated };
  }

  async reject(id: number, dto: any, user: Profile, req?: any) {
    const entry = await this.prisma.hr_time_entries.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException({ success: false, message: 'Time entry not found' });

    const previous = { ...entry };
    const updated = await this.prisma.hr_time_entries.update({
      where: { id },
      data: { status: 'rejected', approved_by: user.id, approved_at: new Date(), admin_notes: dto.reason || entry.admin_notes },
    });
    await this.audit('reject', 'hr_time_entry', id, user, previous, { reason: dto.reason }, req);
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', user.id, id));
    return { success: true, message: 'Time entry rejected', data: updated };
  }

  async tasks(id: number, _user: Profile) {
    const entry = await this.prisma.hr_time_entries.findUnique({
      where: { id },
      include: { employees: { include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true } } } } },
    });
    if (!entry) throw new NotFoundException({ success: false, message: 'Time entry not found' });

    const userId = entry.employees?.user_id;
    if (!userId) return buildLegacyDataEnvelope([]);

    const workItems = await this.prisma.time_entry_work_items.findMany({
      where: { time_entry_id: id },
      include: { project_tasks: true },
      orderBy: { created_at: 'asc' },
    });

    const linkedTaskIds = workItems.filter((wi) => wi.task_id).map((wi) => wi.task_id as number);

    const baseWhere: any = {
      assigned_to: userId,
      status: { in: ['in_progress', 'todo', 'review'] },
    };
    if (linkedTaskIds.length) baseWhere.id = { notIn: linkedTaskIds };

    const candidates = await this.prisma.project_tasks.findMany({
      where: {
        ...baseWhere,
        estimated_hours: { not: null },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        completed_at: true,
        created_at: true,
        actual_hours: true,
        estimated_hours: true,
      },
      orderBy: { updated_at: 'desc' },
      take: 60,
    });

    const allTaskIds = [...new Set([...linkedTaskIds, ...candidates.map((c) => c.id)])];
    const loggedHoursByTask = allTaskIds.length
      ? await this.prisma.time_entry_work_items.groupBy({
          by: ['task_id'],
          where: { task_id: { in: allTaskIds } },
          _sum: { hours_spent: true },
        })
      : [];
    const hoursMap = new Map<number, number>();
    for (const row of loggedHoursByTask) {
      if (row.task_id != null) hoursMap.set(row.task_id, parseNumber(row._sum.hours_spent));
    }

    for (const wi of workItems) {
      if (wi.task_id) (wi as any).hours_logged_elsewhere = hoursMap.get(wi.task_id) ?? 0;
    }

    const tasks = candidates.filter((task) => {
      const estimated = parseNumber(task.estimated_hours);
      const actual = parseNumber(task.actual_hours);
      if (estimated <= 0) return false;
      return actual === 0 || actual < estimated;
    });

    for (const task of tasks) {
      (task as any).hours_logged_elsewhere = hoursMap.get(task.id) ?? 0;
    }

    return { success: true, data: tasks, workItems };
  }

  async addWorkItem(id: number, dto: any, user: Profile) {
    const entry = await this.prisma.hr_time_entries.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException({ success: false, message: 'Time entry not found' });

    if (!dto.task_id && !dto.description) {
      throw new BadRequestException({ success: false, message: 'Provide task_id or description' });
    }

    let taskRecord: any = null;
    let itemType = 'adhoc';

    if (dto.task_id) {
      taskRecord = await this.prisma.project_tasks.findUnique({ where: { id: Number(dto.task_id) } });
      if (!taskRecord) throw new NotFoundException({ success: false, message: 'Task not found' });
      itemType = 'task';
    } else if (dto.description) {
      const employee = await this.prisma.employees.findUnique({ where: { id: entry.employee_id } });
      const userId = employee ? employee.user_id : user.id;

      taskRecord = await this.prisma.project_tasks.create({
        data: {
          title: dto.description,
          description: `Auto-created from timesheet work summary (Time Entry #${id})`,
          status: 'in_progress',
          priority: 'medium',
          assigned_to: userId,
          created_by: user.id,
          project_id: dto.project_id ? Number(dto.project_id) : undefined,
          crm_project_id: dto.crm_project_id ? Number(dto.crm_project_id) : undefined,
          actual_hours: dto.hours_spent ? new Prisma.Decimal(dto.hours_spent) : new Prisma.Decimal(0),
          is_demo: false,
        },
      });
      itemType = 'task';
    }

    const workItem = await this.prisma.time_entry_work_items.create({
      data: {
        time_entry_id: id,
        task_id: taskRecord ? taskRecord.id : null,
        description: dto.description || (taskRecord ? taskRecord.title : ''),
        hours_spent: dto.hours_spent ? new Prisma.Decimal(dto.hours_spent) : null,
        item_type: itemType,
      },
    });

    if (taskRecord && dto.hours_spent) {
      const total = await this.sumHoursForTask(taskRecord.id);
      const current = parseNumber(taskRecord.actual_hours);
      await this.prisma.project_tasks.update({
        where: { id: taskRecord.id },
        data: { actual_hours: new Prisma.Decimal(Math.max(total, current)) },
      });
    }

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', user.id, id));
    return { success: true, data: workItem };
  }

  private async sumHoursForTask(taskId: number) {
    const agg = await this.prisma.time_entry_work_items.aggregate({ where: { task_id: taskId }, _sum: { hours_spent: true } });
    return parseNumber(agg._sum.hours_spent);
  }

  async removeWorkItem(entryId: number, itemId: number) {
    const item = await this.prisma.time_entry_work_items.findFirst({ where: { id: itemId, time_entry_id: entryId } });
    if (!item) throw new NotFoundException({ success: false, message: 'Work item not found' });

    await this.prisma.time_entry_work_items.delete({ where: { id: itemId } });

    if (item.task_id) {
      const total = await this.sumHoursForTask(item.task_id);
      await this.prisma.project_tasks.update({ where: { id: item.task_id }, data: { actual_hours: new Prisma.Decimal(total) } });
    }

    await this.invalidateCache();
    return { success: true };
  }

  async manual(dto: any, user: Profile, req?: any) {
    const isAdmin = ['admin', 'manager'].includes(user.role);
    let targetEmployeeId = dto.employee_id ? Number(dto.employee_id) : undefined;
    if (!isAdmin || !targetEmployeeId) {
      const emp = await this.findEmployee(user.id);
      if (!emp) throw new NotFoundException({ success: false, message: 'Employee profile not found' });
      targetEmployeeId = emp.id;
    }

    const clockIn = new Date(dto.clock_in_time);
    const clockOut = dto.clock_out_time ? new Date(dto.clock_out_time) : null;
    const breakMinutes = dto.break_minutes || 0;

    const data: Prisma.hr_time_entriesUncheckedCreateInput = {
      employee_id: targetEmployeeId,
      clock_in_time: clockIn,
      clock_out_time: clockOut,
      break_minutes: breakMinutes,
      is_manual_entry: true,
      notes: dto.notes,
      admin_notes: `Manual entry by user ${user.id}: ${dto.reason}`,
      edited_by: user.id,
      status: !clockOut ? 'active' : isAdmin ? 'completed' : 'edited',
      total_minutes: clockOut ? Math.round((clockOut.getTime() - clockIn.getTime()) / 60000 - breakMinutes) : null,
    };

    const entry = await this.prisma.hr_time_entries.create({ data });
    await this.audit('create', 'hr_time_entry', entry.id, user, null, data, req);

    if (!isAdmin) {
      this.notifyManager(targetEmployeeId, 'Manual Timesheet Entry', `A manual time entry was submitted${dto.reason ? `: ${dto.reason.substring(0, 100)}` : ''}`, `/admin/hr/timesheets`, { entry_id: entry.id });
    }

    await this.invalidateCache();
    return { success: true, message: 'Manual time entry created', data: entry };
  }

  async bulkDelete(ids: number[], user: Profile, req?: any) {
    const previous = await this.prisma.hr_time_entries.findMany({ where: { id: { in: ids } } });
    const { count } = await this.prisma.hr_time_entries.deleteMany({ where: { id: { in: ids } } });
    await this.audit('bulk_delete', 'hr_time_entry', ids.join(','), user, previous, { count }, req);
    await this.invalidateCache();
    return buildLegacyMessageEnvelope(`${count} time entries deleted`, { deleted: count });
  }

  async remove(id: number, user: Profile, req?: any) {
    const entry = await this.prisma.hr_time_entries.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException({ success: false, message: 'Time entry not found' });

    await this.prisma.hr_time_entries.delete({ where: { id } });
    await this.audit('delete', 'hr_time_entry', id, user, entry, null, req);
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', user.id, id));
    return buildLegacyMessageEnvelope('Time entry deleted');
  }

  private async notifyManager(employeeId: number, title: string, message: string, actionUrl: string, metadata: any) {
    try {
      const employee = await this.prisma.employees.findFirst({
        where: { id: employeeId },
        include: { employees: { include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true } } } } },
      });
      const managerUserId = employee?.employees?.profiles?.id;
      if (managerUserId) {
        await this.prisma.notifications.create({
          data: { user_id: managerUserId, title, message, type: 'info', source: 'hr', metadata: metadata },
        });
      }
    } catch {
      // ignore notification failures
    }
  }
}
