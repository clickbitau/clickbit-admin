import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { buildLegacyDataEnvelope, buildLegacyMessageEnvelope } from './hr-utils';

function timeToDate(time: string): Date {
  return new Date(`1970-01-01T${time}:00`);
}

function mapShift(shift: any) {
  const s = { ...shift };
  const employee = s.employees_hr_shifts_employee_idToemployees || s.employee || {};
  const profile = employee.profiles || employee.user;
  if (employee) {
    s.employee = {
      ...employee,
      name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.email || 'Unknown Employee',
      user: profile,
    };
  }
  delete s.employees_hr_shifts_employee_idToemployees;
  return s;
}

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findEmployee(userId: number) {
    return this.prisma.employees.findFirst({ where: { user_id: userId, deleted_at: null } });
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

  private computeDatetimes(shift_date: string, start_time: string, end_time: string) {
    const startDatetime = new Date(`${shift_date}T${start_time}`);
    let endDatetime = new Date(`${shift_date}T${end_time}`);
    if (endDatetime < startDatetime) {
      endDatetime = new Date(endDatetime.getTime() + 24 * 60 * 60 * 1000);
    }
    return { start_datetime: startDatetime, end_datetime: endDatetime };
  }

  async findAll(query: any, user: Profile) {
    let targetEmployeeId: number | undefined = query.employee_id ? Number(query.employee_id) : undefined;
    if (user.role !== 'admin' && user.role !== 'manager') {
      const employee = await this.findEmployee(user.id);
      if (!employee) throw new NotFoundException({ success: false, message: 'Employee profile not found' });
      targetEmployeeId = employee.id;
    }

    const where: Prisma.hr_shiftsWhereInput = { status: { notIn: ['cancelled'] as any } };
    if (targetEmployeeId) where.employee_id = targetEmployeeId;
    if (query.status) where.status = query.status;
    if (query.department) where.department = query.department;
    if (query.start_date && query.end_date) {
      where.shift_date = { gte: new Date(query.start_date), lte: new Date(query.end_date) };
    } else if (query.start_date) {
      where.shift_date = { gte: new Date(query.start_date) };
    } else if (query.end_date) {
      where.shift_date = { lte: new Date(query.end_date) };
    }

    const shifts = await this.prisma.hr_shifts.findMany({
      where,
      include: {
        employees_hr_shifts_employee_idToemployees: {
          include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } } },
        },
      },
      orderBy: [{ shift_date: 'asc' }, { start_time: 'asc' }],
    });

    return buildLegacyDataEnvelope(shifts.map(mapShift));
  }

  async findOne(id: number, user: Profile) {
    const shift = await this.prisma.hr_shifts.findUnique({
      where: { id },
      include: {
        employees_hr_shifts_employee_idToemployees: {
          include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } } },
        },
        employees_hr_shifts_swap_requested_withToemployees: {
          include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true } } },
        },
      },
    });
    if (!shift) throw new NotFoundException({ success: false, message: 'Shift not found' });

    if (user.role !== 'admin' && user.role !== 'manager') {
      const employee = await this.findEmployee(user.id);
      if (!employee || shift.employee_id !== employee.id) {
        throw new ForbiddenException({ success: false, message: 'Not authorized to view this shift' });
      }
    }

    return buildLegacyDataEnvelope(mapShift(shift));
  }

  async create(dto: any, user: Profile, req?: any) {
    const { start_datetime, end_datetime } = this.computeDatetimes(dto.shift_date, dto.start_time, dto.end_time);

    const data: Prisma.hr_shiftsUncheckedCreateInput = {
      employee_id: Number(dto.employee_id),
      shift_date: new Date(dto.shift_date),
      start_time: timeToDate(dto.start_time),
      end_time: timeToDate(dto.end_time),
      start_datetime,
      end_datetime,
      scheduled_break_minutes: dto.scheduled_break_minutes ?? 30,
      shift_type: (dto.shift_type) || 'regular',
      department: dto.department,
      position: dto.position,
      location: dto.location,
      color: dto.color || '#3B82F6',
      notes: dto.notes,
      internal_notes: dto.internal_notes,
      tasks: dto.tasks,
      location_coordinates: dto.location_coordinates,
      overtime_rate: dto.overtime_rate ? new Prisma.Decimal(dto.overtime_rate) : undefined,
      created_by: user.id,
    };

    const shift = await this.prisma.hr_shifts.create({ data });
    await this.audit('create', 'hr_shift', shift.id, user, null, data, req);
    return buildLegacyDataEnvelope(shift);
  }

  async batch(dto: any, user: Profile, req?: any) {
    const created = [];
    for (const date of dto.dates) {
      const { start_datetime, end_datetime } = this.computeDatetimes(date, dto.start_time, dto.end_time);
      const shift = await this.prisma.hr_shifts.create({
        data: {
          employee_id: Number(dto.employee_id),
          shift_date: new Date(date),
          start_time: timeToDate(dto.start_time),
          end_time: timeToDate(dto.end_time),
          start_datetime,
          end_datetime,
          scheduled_break_minutes: dto.scheduled_break_minutes ?? 30,
          shift_type: (dto.shift_type) || 'regular',
          location: dto.location,
          color: dto.color || '#3B82F6',
          notes: dto.notes,
          created_by: user.id,
        },
      });
      await this.audit('create', 'hr_shift', shift.id, user, null, { ...shift }, req);
      created.push(shift);
    }
    return { success: true, message: `${created.length} shift(s) created`, data: created };
  }

  async update(id: number, dto: any, user: Profile, req?: any) {
    const existing = await this.prisma.hr_shifts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ success: false, message: 'Shift not found' });

    const previous = { ...existing };
    const data: Prisma.hr_shiftsUncheckedUpdateInput = { ...dto };

    if (dto.shift_date && dto.start_time && dto.end_time) {
      const { start_datetime, end_datetime } = this.computeDatetimes(dto.shift_date, dto.start_time, dto.end_time);
      data.start_datetime = start_datetime;
      data.end_datetime = end_datetime;
    }

    if (dto.start_time && !data.start_datetime) data.start_time = timeToDate(dto.start_time);
    if (dto.end_time && !data.end_datetime) data.end_time = timeToDate(dto.end_time);
    if (dto.overtime_rate !== undefined) data.overtime_rate = new Prisma.Decimal(dto.overtime_rate);

    const shift = await this.prisma.hr_shifts.update({ where: { id }, data });
    await this.audit('update', 'hr_shift', id, user, previous, data, req);
    return buildLegacyDataEnvelope(shift);
  }

  async remove(id: number, user: Profile, req?: any) {
    const shift = await this.prisma.hr_shifts.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException({ success: false, message: 'Shift not found' });
    await this.prisma.hr_shifts.delete({ where: { id } });
    await this.audit('delete', 'hr_shift', id, user, shift, null, req);
    return buildLegacyMessageEnvelope('Shift deleted');
  }

  async removeByEmployee(employeeId: string, query: any) {
    if (!query.start_date || !query.end_date) {
      throw new BadRequestException({ success: false, message: 'start_date and end_date are required' });
    }
    const { count } = await this.prisma.hr_shifts.deleteMany({
      where: {
        employee_id: Number(employeeId),
        shift_date: { gte: new Date(query.start_date), lte: new Date(query.end_date) },
      },
    });
    return { success: true, message: `${count} shift(s) removed`, data: { deleted: count } };
  }

  async confirm(id: number, user: Profile) {
    const employee = await this.findEmployee(user.id);
    if (!employee) throw new NotFoundException({ success: false, message: 'Employee profile not found' });

    const shift = await this.prisma.hr_shifts.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException({ success: false, message: 'Shift not found' });
    if (shift.employee_id !== employee.id) throw new ForbiddenException({ success: false, message: 'Not your shift' });

    const updated = await this.prisma.hr_shifts.update({
      where: { id },
      data: { employee_confirmed: true, employee_confirmed_at: new Date(), status: 'confirmed' as any },
    });
    return { success: true, message: 'Shift confirmed', data: updated };
  }

  async publish(dto: any, user: Profile, req?: any) {
    const now = new Date();
    const ids = dto.shift_ids.map(Number);
    await this.prisma.hr_shifts.updateMany({
      where: { id: { in: ids }, status: 'scheduled' },
      data: { status: 'published' as any, published_at: now, published_by: user.id },
    });
    const shifts = await this.prisma.hr_shifts.findMany({ where: { id: { in: ids } } });
    await this.audit('publish', 'hr_shift', ids.join(','), user, null, { published_at: now }, req);
    return { success: true, message: `${shifts.length} shifts published`, data: shifts };
  }

  async copyWeek(dto: any, user: Profile, _req?: any) {
    const sourceDate = new Date(dto.source_week_start);
    const targetDate = new Date(dto.target_week_start);
    if (isNaN(sourceDate.getTime())) throw new BadRequestException({ success: false, message: 'Invalid source week start date' });
    if (isNaN(targetDate.getTime())) throw new BadRequestException({ success: false, message: 'Invalid target week start date' });
    sourceDate.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    const sourceWeekEnd = new Date(sourceDate);
    sourceWeekEnd.setDate(sourceWeekEnd.getDate() + 6);
    sourceWeekEnd.setHours(23, 59, 59, 999);

    const sourceStartStr = sourceDate.toISOString().split('T')[0];
    const sourceEndStr = sourceWeekEnd.toISOString().split('T')[0];

    const where: Prisma.hr_shiftsWhereInput = {
      shift_date: { gte: new Date(sourceStartStr), lte: new Date(sourceEndStr) },
    };
    if (dto.employee_ids && Array.isArray(dto.employee_ids) && dto.employee_ids.length) {
      where.employee_id = { in: dto.employee_ids.map(Number) };
    }

    const sourceShifts = await this.prisma.hr_shifts.findMany({ where });
    const dayDiff = Math.round((targetDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24));

    const newShifts = [];
    for (const shift of sourceShifts) {
      const shiftDate = new Date(shift.shift_date);
      const newDate = new Date(shiftDate);
      newDate.setDate(newDate.getDate() + dayDiff);

      const { start_datetime, end_datetime } = this.computeDatetimes(newDate.toISOString().split('T')[0], this.timeToHHMM(shift.start_time), this.timeToHHMM(shift.end_time));

      const newShift = await this.prisma.hr_shifts.create({
        data: {
          employee_id: shift.employee_id,
          shift_date: newDate,
          start_time: shift.start_time,
          end_time: shift.end_time,
          start_datetime,
          end_datetime,
          scheduled_break_minutes: shift.scheduled_break_minutes,
          shift_type: shift.shift_type,
          department: shift.department,
          position: shift.position,
          location: shift.location,
          location_coordinates: shift.location_coordinates as any,
          color: shift.color,
          notes: shift.notes,
          tasks: shift.tasks as any,
          is_overtime: shift.is_overtime,
          overtime_rate: shift.overtime_rate,
          status: 'scheduled',
          created_by: user.id,
        },
      });
      newShifts.push(newShift);
    }

    return { success: true, message: `${newShifts.length} shifts copied`, data: newShifts };
  }

  private timeToHHMM(value: Date | string): string {
    if (value instanceof Date) return value.toISOString().slice(11, 16);
    return String(value).slice(0, 5);
  }

  async openShifts(query: any) {
    const where: Prisma.hr_shiftsWhereInput = {
      is_open_shift: true,
      status: { notIn: ['cancelled', 'completed'] as any },
    };
    if (query.start_date && query.end_date) {
      where.shift_date = { gte: new Date(query.start_date), lte: new Date(query.end_date) };
    } else if (query.start_date) {
      where.shift_date = { gte: new Date(query.start_date) };
    }

    const shifts = await this.prisma.hr_shifts.findMany({
      where,
      include: {
        employees_hr_shifts_employee_idToemployees: {
          include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } } },
        },
      },
      orderBy: [{ shift_date: 'asc' }, { start_time: 'asc' }],
    });

    return buildLegacyDataEnvelope(shifts.map(mapShift));
  }

  async claim(id: number, user: Profile) {
    const employee = await this.findEmployee(user.id);
    if (!employee) throw new NotFoundException({ success: false, message: 'Employee profile not found' });

    const shift = await this.prisma.hr_shifts.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException({ success: false, message: 'Shift not found' });
    if (!shift.is_open_shift) throw new BadRequestException({ success: false, message: 'This is not an open shift' });

    const claimed = Array.isArray(shift.open_shift_claimed_by) ? [...shift.open_shift_claimed_by] : [];
    if (claimed.includes(employee.id)) throw new BadRequestException({ success: false, message: 'Already claimed this shift' });
    if (shift.open_shift_limit && claimed.length >= shift.open_shift_limit) {
      throw new BadRequestException({ success: false, message: 'Shift is fully claimed' });
    }

    claimed.push(employee.id);
    const updated = await this.prisma.hr_shifts.update({ where: { id }, data: { open_shift_claimed_by: claimed as any } });
    return { success: true, message: 'Shift claimed', data: updated };
  }
}
