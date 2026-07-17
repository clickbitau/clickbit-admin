import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { StorageService } from '../storage/storage.service';
import { buildLegacyDataEnvelope, buildLegacyMessageEnvelope, parseNumber } from './hr-utils';

const PERTH_TZ = 'Australia/Perth';

function perthDateStr(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: PERTH_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
}

function perthTimeStr(d = new Date()): string {
  return d.toLocaleTimeString('en-GB', { timeZone: PERTH_TZ, hour12: false, hour: '2-digit', minute: '2-digit' });
}

function perthRange(dateStr: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00+08:00`),
    end: new Date(`${dateStr}T23:59:59.999+08:00`),
  };
}

function minutesBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}

function durationMinutes(entry: { clock_in_time: Date; clock_out_time?: Date | null; break_minutes?: number | null }): number {
  const end = entry.clock_out_time || new Date();
  const gross = minutesBetween(entry.clock_in_time, end);
  const breaks = entry.break_minutes || 0;
  return Math.max(0, gross - breaks);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export interface TimeClockStatus {
  employee: {
    id: number;
    name: string;
    canClockIn: boolean;
    requireGps: boolean;
    requirePhoto: boolean;
  };
  activeEntry: {
    id: number;
    clockInTime: Date;
    isOnBreak: boolean;
    breakStartTime?: Date | null;
    totalBreakMinutes: number;
    currentDuration: number;
  } | null;
  todayHours: number;
  weeklyHours: number;
  todayShift: unknown;
}

@Injectable()
export class TimeClockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async findEmployee(userId: number) {
    const employee = await this.prisma.employees.findFirst({
      where: { user_id: userId, deleted_at: null },
      include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true } } },
    });
    if (!employee) throw new NotFoundException({ success: false, message: 'No employee profile found. Please contact HR.' });
    return employee;
  }

  private employeeName(employee: { profiles?: { first_name?: string | null; last_name?: string | null; email: string } | null }) {
    const p = employee.profiles;
    return `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || p?.email || 'Unknown Employee';
  }

  private async getActiveEntry(employeeId: number) {
    return this.prisma.hr_time_entries.findFirst({
      where: { employee_id: employeeId, clock_out_time: null },
      orderBy: { clock_in_time: 'desc' },
    });
  }

  private async todayHours(employeeId: number): Promise<number> {
    const { start, end } = perthRange(perthDateStr());
    const entries = await this.prisma.hr_time_entries.findMany({
      where: { employee_id: employeeId, clock_in_time: { gte: start, lte: end } },
    });
    return entries.reduce((sum, e) => sum + (e.total_minutes ?? durationMinutes(e)), 0) / 60;
  }

  private async weeklyHours(employeeId: number): Promise<number> {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setUTCDate(diff);
    monday.setUTCHours(0, 0, 0, 0);
    const entries = await this.prisma.hr_time_entries.findMany({
      where: { employee_id: employeeId, clock_in_time: { gte: monday } },
    });
    return entries.reduce((sum, e) => sum + (e.total_minutes ?? durationMinutes(e)), 0) / 60;
  }

  async status(user: Profile) {
    const employee = await this.findEmployee(user.id);
    const active = await this.getActiveEntry(employee.id);
    const todayPerth = perthDateStr();
    const { start, end } = perthRange(todayPerth);
    const todayShift = await this.prisma.hr_shifts.findFirst({
      where: { employee_id: employee.id, shift_date: { gte: start, lte: end }, status: { notIn: ['cancelled'] } },
    });
    const status: TimeClockStatus = {
      employee: {
        id: employee.id,
        name: this.employeeName(employee),
        canClockIn: employee.can_clock_in ?? true,
        requireGps: employee.require_gps_clock_in ?? false,
        requirePhoto: employee.require_photo_clock_in ?? false,
      },
      activeEntry: active
        ? {
            id: active.id,
            clockInTime: active.clock_in_time,
            isOnBreak: active.is_on_break ?? false,
            breakStartTime: active.break_start_time,
            totalBreakMinutes: active.break_minutes ?? 0,
            currentDuration: durationMinutes(active),
          }
        : null,
      todayHours: await this.todayHours(employee.id),
      weeklyHours: await this.weeklyHours(employee.id),
      todayShift,
    };
    return buildLegacyDataEnvelope(status);
  }

  async autoClockIn(user: Profile, req: any) {
    const employee = await this.findEmployee(user.id);
    if (!employee.can_clock_in) {
      return buildLegacyDataEnvelope({ auto_clocked: false, reason: 'clock_in_disabled' });
    }
    const active = await this.getActiveEntry(employee.id);
    if (active) {
      return buildLegacyDataEnvelope({ auto_clocked: false, reason: 'already_clocked_in', entry: active });
    }
    const todayPerth = perthDateStr();
    const { start, end } = perthRange(todayPerth);
    const todayEntry = await this.prisma.hr_time_entries.findFirst({
      where: { employee_id: employee.id, clock_in_time: { gte: start, lte: end } },
    });
    if (todayEntry) {
      return buildLegacyDataEnvelope({ auto_clocked: false, reason: 'already_worked_today' });
    }
    const todayShift = await this.prisma.hr_shifts.findFirst({
      where: { employee_id: employee.id, shift_date: { gte: start, lte: end }, status: { in: ['published', 'confirmed'] } },
    });
    if (!todayShift) {
      return buildLegacyDataEnvelope({ auto_clocked: false, reason: 'no_shift_today' });
    }
    const currentMinutes = this.parseTimeToMinutes(perthTimeStr());
    const startMinutes = this.parseTimeToMinutes(this.timeToHHMM(todayShift.start_time));
    const endMinutes = this.parseTimeToMinutes(this.timeToHHMM(todayShift.end_time));
    if (currentMinutes < startMinutes - 30 || currentMinutes > endMinutes) {
      return buildLegacyDataEnvelope({ auto_clocked: false, reason: 'outside_shift_window', shift: { start: todayShift.start_time, end: todayShift.end_time } });
    }
    const entry = await this.prisma.hr_time_entries.create({
      data: {
        employee_id: employee.id,
        clock_in_time: new Date(),
        shift_id: todayShift.id,
        notes: 'Auto clock-in on first daily login',
        device_info: { userAgent: req.headers['user-agent'], platform: req.headers['sec-ch-ua-platform'] } as any,
        ip_address: req.ip || '',
      },
    });
    return buildLegacyDataEnvelope({ auto_clocked: true, message: `Auto clocked in for ${this.timeToHHMM(todayShift.start_time)} - ${this.timeToHHMM(todayShift.end_time)} shift`, data: entry });
  }

  private timeToHHMM(value: Date | string): string {
    if (value instanceof Date) return value.toISOString().slice(11, 16);
    return String(value).slice(0, 5);
  }

  private parseTimeToMinutes(value: string): number {
    const [h, m] = value.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }

  async clockIn(user: Profile, dto: any, req: any) {
    const employee = await this.findEmployee(user.id);
    if (!employee.can_clock_in) {
      throw new ForbiddenTimeClock('You are not authorized to clock in');
    }
    if (employee.require_gps_clock_in && (!dto.latitude || !dto.longitude)) {
      throw new BadRequestException({ success: false, message: 'GPS location is required to clock in' });
    }
    if (employee.require_photo_clock_in && !dto.photo_url) {
      throw new BadRequestException({ success: false, message: 'A live photo is required to clock in' });
    }
    const locations = Array.isArray(employee.allowed_clock_in_locations) ? employee.allowed_clock_in_locations : [];
    if (locations.length > 0 && dto.latitude && dto.longitude) {
      const lat = Number(dto.latitude);
      const lng = Number(dto.longitude);
      const within = locations.some((loc: any) => {
        const distance = haversineKm(lat, lng, Number(loc.lat), Number(loc.lng)) * 1000;
        return distance <= (loc.radius ?? 100);
      });
      if (!within) throw new BadRequestException({ success: false, message: 'You must be at an approved location to clock in' });
    }
    const existing = await this.getActiveEntry(employee.id);
    if (existing) throw new BadRequestException({ success: false, message: 'Already clocked in' });
    const data: Prisma.hr_time_entriesUncheckedCreateInput = {
      employee_id: employee.id,
      clock_in_time: new Date(),
      clock_in_latitude: dto.latitude ? new Prisma.Decimal(dto.latitude) : undefined,
      clock_in_longitude: dto.longitude ? new Prisma.Decimal(dto.longitude) : undefined,
      clock_in_address: dto.address,
      clock_in_accuracy: dto.accuracy ? new Prisma.Decimal(dto.accuracy) : undefined,
      clock_in_photo_url: dto.photo_url,
      shift_id: dto.shift_id ? Number(dto.shift_id) : undefined,
      device_info: { userAgent: req.headers['user-agent'], platform: req.headers['sec-ch-ua-platform'] },
      ip_address: req.ip || '',
    };
    const entry = await this.prisma.hr_time_entries.create({ data });
    return { success: true, message: 'Clocked in successfully', data: entry };
  }

  async clockOut(user: Profile, dto: any) {
    const employee = await this.findEmployee(user.id);
    let active: any = await this.getActiveEntry(employee.id);
    if (!active) throw new BadRequestException({ success: false, message: 'No active clock-in found' });
    if (active.is_on_break) {
      active = await this.endBreakInternal(active);
    }
    const grossMinutes = durationMinutes({ clock_in_time: active.clock_in_time, break_minutes: active.break_minutes });
    const workItems = Array.isArray(dto.work_items) ? dto.work_items : [];
    if (grossMinutes >= 15 && workItems.length === 0) {
      throw new BadRequestException({ success: false, message: 'You must log at least one task or work item before clocking out.' });
    }
    const totalTaskHours = workItems.reduce((sum: number, item: any) => sum + (parseNumber(item.hours_spent) || 0), 0);
    if (grossMinutes >= 15 && Math.abs(totalTaskHours - grossMinutes / 60) > 24) {
      throw new BadRequestException({ success: false, message: `Hours mismatch! Logged task hours (${totalTaskHours.toFixed(2)}h) is wildly inaccurate. Must be within 24h of shift.` });
    }
    const merged = this.mergeWorkItems(workItems);
    const updated = await this.prisma.hr_time_entries.update({
      where: { id: active.id },
      data: {
        clock_out_time: new Date(),
        clock_out_latitude: dto.latitude ? new Prisma.Decimal(dto.latitude) : undefined,
        clock_out_longitude: dto.longitude ? new Prisma.Decimal(dto.longitude) : undefined,
        clock_out_address: dto.address,
        clock_out_accuracy: dto.accuracy ? new Prisma.Decimal(dto.accuracy) : undefined,
        clock_out_photo_url: dto.photo_url,
        total_minutes: grossMinutes,
        status: 'completed' as any,
        notes: dto.session_notes ? String(dto.session_notes).trim() : active.notes,
      },
    });
    let workItemsSaved = 0;
    for (const item of merged) {
      let taskId: number | undefined = item.task_id ? Number(item.task_id) : undefined;
      const hours = item.hours_spent ? parseNumber(item.hours_spent) : null;
      const projectId = item.project_id ? Number(item.project_id) : undefined;
      if (!taskId && item.description?.trim()) {
        const newTask = await this.prisma.project_tasks.create({
          data: {
            title: item.description.trim(),
            status: 'completed',
            priority: 'medium',
            assigned_to: user.id,
            created_by: user.id,
            completed_at: new Date(),
            crm_project_id: projectId,
            description: `Auto-created from clock-out summary on ${perthDateStr()}`,
          },
        });
        taskId = newTask.id;
      }
      if (taskId && projectId && item.task_id) {
        const existingTask = await this.prisma.project_tasks.findUnique({ where: { id: taskId } });
        if (existingTask && !existingTask.crm_project_id) {
          await this.prisma.project_tasks.update({ where: { id: taskId }, data: { crm_project_id: projectId } });
        }
      }
      await this.prisma.time_entry_work_items.create({
        data: {
          time_entry_id: updated.id,
          task_id: taskId,
          description: item.description || null,
          item_type: item.task_id ? 'task' : 'adhoc',
          hours_spent: hours ? new Prisma.Decimal(hours) : undefined,
        },
      });
      if (taskId && hours && hours > 0) {
        const totalLogged = await this.prisma.time_entry_work_items.aggregate({ where: { task_id: taskId }, _sum: { hours_spent: true } });
        const total = parseNumber(totalLogged._sum.hours_spent);
        const task = await this.prisma.project_tasks.findUnique({ where: { id: taskId } });
        if (task) {
          const current = parseNumber(task.actual_hours);
          await this.prisma.project_tasks.update({ where: { id: taskId }, data: { actual_hours: new Prisma.Decimal(Math.max(total, current)) } });
        }
      }
      if (taskId && item.description?.trim()) {
        await this.prisma.task_comments.create({
          data: {
            task_id: taskId,
            author_id: user.id,
            content: `[Clock-out update]${hours ? ` (${hours}h)` : ''} ${item.description.trim()}`,
            is_internal: true,
          },
        });
      }
      workItemsSaved += 1;
    }
    return { success: true, message: 'Clocked out successfully', data: { totalMinutes: updated.total_minutes, formattedDuration: formatDuration(updated.total_minutes || 0), workItemsSaved } };
  }

  private mergeWorkItems(items: any[]) {
    const map = new Map<string, any>();
    for (const item of items) {
      const taskId = item.task_id ? Number(item.task_id) : null;
      const key = taskId ? `task-${taskId}` : `adhoc-${item.description || ''}`;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.hours_spent = (parseNumber(existing.hours_spent) + parseNumber(item.hours_spent)).toFixed(2);
      } else {
        map.set(key, { ...item });
      }
    }
    return Array.from(map.values());
  }

  async startBreak(user: Profile, breakType?: string) {
    const employee = await this.findEmployee(user.id);
    const active = await this.getActiveEntry(employee.id);
    if (!active) throw new BadRequestException({ success: false, message: 'No active clock-in found' });
    if (active.is_on_break) return buildLegacyDataEnvelope(active);
    const breaks = Array.isArray(active.breaks) ? active.breaks : [];
    breaks.push({ type: breakType || 'general', start: new Date().toISOString() });
    const updated = await this.prisma.hr_time_entries.update({
      where: { id: active.id },
      data: { is_on_break: true, break_start_time: new Date(), breaks: breaks as any },
    });
    return buildLegacyMessageEnvelope('Break started', updated);
  }

  async endBreak(user: Profile) {
    const employee = await this.findEmployee(user.id);
    const active = await this.getActiveEntry(employee.id);
    if (!active) throw new BadRequestException({ success: false, message: 'No active clock-in found' });
    const updated = await this.endBreakInternal(active);
    return buildLegacyMessageEnvelope('Break ended', updated);
  }

  private async endBreakInternal(entry: any) {
    if (!entry.is_on_break) return entry;
    const start = entry.break_start_time || new Date();
    const breakMinutes = minutesBetween(start, new Date());
    const breaks = Array.isArray(entry.breaks) ? entry.breaks : [];
    const last: any = breaks[breaks.length - 1] || {};
    last.end = new Date().toISOString();
    last.minutes = breakMinutes;
    breaks[breaks.length - 1] = last;
    return this.prisma.hr_time_entries.update({
      where: { id: entry.id },
      data: { is_on_break: false, break_start_time: null, break_minutes: (entry.break_minutes || 0) + breakMinutes, breaks: breaks },
    });
  }

  async activeEntries(_user: Profile) {
    const entries = await this.prisma.hr_time_entries.findMany({
      where: { clock_out_time: null },
      include: { employees: { include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } } } } },
      orderBy: { clock_in_time: 'desc' },
    });
    const formatted = entries.map((entry) => {
      const emp = entry.employees;
      const p = emp?.profiles;
      return {
        id: entry.id,
        employee_id: emp?.id,
        employee_name: `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || p?.email,
        employee_email: p?.email,
        employee_avatar: p?.avatar,
        department: emp?.department || 'Unassigned',
        clock_in_time: entry.clock_in_time,
        is_on_break: entry.is_on_break,
        break_start_time: entry.break_start_time,
        total_break_minutes: entry.break_minutes || 0,
        duration_minutes: durationMinutes(entry),
        formatted_duration: formatDuration(durationMinutes(entry)),
      };
    });
    return buildLegacyDataEnvelope(formatted);
  }

  async addBreadcrumb(user: Profile, dto: any) {
    const employee = await this.findEmployee(user.id);
    const active = await this.getActiveEntry(employee.id);
    if (!active) throw new BadRequestException({ success: false, message: 'No active clock-in found' });
    const crumbs = Array.isArray(active.gps_breadcrumbs) ? active.gps_breadcrumbs : [];
    crumbs.push({ latitude: Number(dto.latitude), longitude: Number(dto.longitude), accuracy: dto.accuracy ? Number(dto.accuracy) : undefined, address: dto.address, timestamp: new Date().toISOString() });
    await this.prisma.hr_time_entries.update({ where: { id: active.id }, data: { gps_breadcrumbs: crumbs as any } });
    return buildLegacyMessageEnvelope('Breadcrumb recorded');
  }

  async uploadPhoto(user: Profile, file: Express.Multer.File) {
    if (!file) throw new BadRequestException({ success: false, message: 'No photo provided' });
    const folder = `timesheets/employee-${user.id}`;
    const filename = `clockin-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const result = await this.storage.upload(file.buffer, 'avatars', filename, 'image/jpeg', folder, filename);
    if (!result.success) throw new BadRequestException({ success: false, message: result.error });
    return { success: true, url: result.url };
  }
}

class ForbiddenTimeClock extends BadRequestException {
  constructor(message: string) {
    super({ success: false, message });
  }
}
