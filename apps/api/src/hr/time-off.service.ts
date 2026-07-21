import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { asJsonInput, buildLegacyDataEnvelope, buildLegacyListEnvelope, buildLegacyMessageEnvelope, parseNumber } from './hr-utils';
import { CacheService } from '../redis/cache.service';

const profileSelect = { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } } as const;

const timeOffInclude = {
  employees_hr_time_off_requests_employee_idToemployees: {
    include: { profiles: profileSelect },
  },
  employees_hr_time_off_requests_substitute_employee_idToemployees: {
    include: { profiles: profileSelect, employee_documents: true },
  },
  profiles: { select: { id: true, first_name: true, last_name: true } },
} as const;

function mapTimeOff(request: Prisma.hr_time_off_requestsGetPayload<{ include: typeof timeOffInclude }>) {
  const r = request as unknown as Record<string, unknown>;
  const employee = r.employees_hr_time_off_requests_employee_idToemployees as any;
  const substitute = r.employees_hr_time_off_requests_substitute_employee_idToemployees as any;
  const reviewer = r.profiles as any;
  return {
    ...r,
    employee: employee ? { ...employee, user: employee?.profiles } : undefined,
    substitute: substitute ? { ...substitute, user: substitute?.profiles, documents: substitute?.employee_documents } : undefined,
    reviewer: reviewer || undefined,
    employees_hr_time_off_requests_employee_idToemployees: undefined,
    employees_hr_time_off_requests_substitute_employee_idToemployees: undefined,
    profiles: undefined,
    total_days: parseNumber(r.total_days),
    total_hours: parseNumber(r.total_hours),
    balance_at_request: parseNumber(r.balance_at_request),
  };
}

function parseDateOnly(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class TimeOffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('time-off', ...parts) ?? `time-off:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
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
    employee_id?: string;
    status?: string;
    leave_type?: string;
    year?: string;
    scope?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }, user: Profile) {
    return this.cached(this.cacheKey('list', user.id, JSON.stringify(query)), async () => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    let targetEmployeeId = query.employee_id ? Number(query.employee_id) : undefined;
    if (query.scope === 'mine' || !this.isAdminOrManager(user)) {
      const employee = await this.prisma.employees.findFirst({ where: { user_id: user.id, deleted_at: null } });
      if (!employee) {
        if (!this.isAdminOrManager(user)) {
          throw new NotFoundException({ success: false, message: 'Employee profile not found' });
        }
      } else {
        targetEmployeeId = employee.id;
      }
    }

    const where: Prisma.hr_time_off_requestsWhereInput = {};
    if (targetEmployeeId) where.employee_id = targetEmployeeId;
    if (query.status) where.status = query.status as any;
    if (query.leave_type) where.leave_type = query.leave_type as any;
    if (query.year) {
      const year = Number(query.year);
      where.start_date = { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) };
    }

    const orderBy: Prisma.hr_time_off_requestsOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'submitted_at';
    const sortDir = query.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    (orderBy as any)[sortField] = sortDir;

    const [total, rows] = await Promise.all([
      this.prisma.hr_time_off_requests.count({ where }),
      this.prisma.hr_time_off_requests.findMany({ where, include: timeOffInclude, orderBy, skip, take: limit }),
    ]);

    return buildLegacyListEnvelope(rows.map(mapTimeOff), total, page, limit);
    });
  }

  async create(dto: Record<string, unknown>, user: Profile) {
    let employee;
    if (dto.employee_id && this.isAdminOrManager(user)) {
      employee = await this.prisma.employees.findUnique({ where: { id: Number(dto.employee_id), deleted_at: null } });
    } else {
      employee = await this.prisma.employees.findFirst({ where: { user_id: user.id, deleted_at: null } });
    }

    if (!employee) throw new NotFoundException({ success: false, message: 'Employee profile not found' });

    const balance = this.getLeaveBalance(employee, dto.leave_type as string);
    const requestNumber = await this.generateRequestNumber();

    const data: Prisma.hr_time_off_requestsUncheckedCreateInput = {
      employee_id: employee.id,
      request_number: requestNumber,
      leave_type: dto.leave_type as any,
      start_date: parseDateOnly(dto.start_date as string)!,
      end_date: parseDateOnly(dto.end_date as string)!,
      is_partial_day: Boolean(dto.is_partial_day),
      partial_day_type: (dto.partial_day_type as any) || null,
      partial_start_time: typeof dto.partial_start_time === 'string' ? new Date(`1970-01-01T${dto.partial_start_time}`) : undefined,
      partial_end_time: typeof dto.partial_end_time === 'string' ? new Date(`1970-01-01T${dto.partial_end_time}`) : undefined,
      total_days: dto.total_days !== undefined ? Number(dto.total_days) : null,
      total_hours: dto.total_hours !== undefined ? Number(dto.total_hours) : null,
      reason: (dto.reason as string) || null,
      notes: (dto.notes as string) || null,
      substitute_employee_id: dto.substitute_employee_id ? Number(dto.substitute_employee_id) : null,
      attachments: asJsonInput(dto.attachments) ?? [],
      balance_at_request: Number(balance) || 0,
      deducted_from_balance: false,
      status: 'pending',
      is_demo: false,
    };

    const created = await this.prisma.hr_time_off_requests.create({ data, include: timeOffInclude });
    await this.invalidateCache();
    return buildLegacyDataEnvelope(mapTimeOff(created));
  }

  async approve(id: number, dto: Record<string, unknown>, _user: Profile) {
    const request = await this.findOneRaw(id);
    if (request.status !== 'pending') {
      throw new BadRequestException({ success: false, message: 'Request is not pending' });
    }

    await this.prisma.hr_time_off_requests.update({
      where: { id },
      data: {
        status: 'approved',
        reviewed_by: _user.id,
        reviewed_at: new Date(),
        review_notes: (dto.notes as string) || request.review_notes,
      },
    });

    await this.adjustLeaveBalance(request.employee_id, request.leave_type, -(request.total_days ? Number(request.total_days) : 0));
    await this.prisma.hr_time_off_requests.update({ where: { id }, data: { deducted_from_balance: true } });

    const updated = await this.prisma.hr_time_off_requests.findUniqueOrThrow({ where: { id }, include: timeOffInclude });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Request approved', mapTimeOff(updated));
  }

  async reject(id: number, dto: Record<string, unknown>, _user: Profile) {
    const request = await this.findOneRaw(id);
    if (request.status !== 'pending') {
      throw new BadRequestException({ success: false, message: 'Request is not pending' });
    }

    if (request.deducted_from_balance) {
      await this.adjustLeaveBalance(request.employee_id, request.leave_type, request.total_days ? Number(request.total_days) : 0);
    }

    const updated = await this.prisma.hr_time_off_requests.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewed_by: _user.id,
        reviewed_at: new Date(),
        review_notes: (dto.notes as string) || request.review_notes,
        deducted_from_balance: false,
      },
      include: timeOffInclude,
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Request rejected', mapTimeOff(updated));
  }

  async revoke(id: number, dto: Record<string, unknown>, _user: Profile) {
    const request = await this.findOneRaw(id);
    if (request.status !== 'approved') {
      throw new BadRequestException({ success: false, message: 'Only approved requests can be revoked' });
    }
    if (request.deducted_from_balance) {
      await this.adjustLeaveBalance(request.employee_id, request.leave_type, request.total_days ? Number(request.total_days) : 0);
    }

    const updated = await this.prisma.hr_time_off_requests.update({
      where: { id },
      data: {
        status: 'cancelled',
        deducted_from_balance: false,
        review_notes: (dto.notes as string) || request.review_notes,
      },
      include: timeOffInclude,
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Request revoked and leave balance restored', mapTimeOff(updated));
  }

  async cancel(id: number, user: Profile) {
    const request = await this.findOneRaw(id);
    const employee = await this.prisma.employees.findFirst({ where: { user_id: user.id, deleted_at: null } });
    if (request.employee_id !== employee?.id && !this.isAdminOrManager(user) && user.role !== 'admin') {
      throw new ForbiddenException({ success: false, message: 'Not authorized' });
    }
    if (['approved'].includes(request.status as string) && request.deducted_from_balance) {
      await this.adjustLeaveBalance(request.employee_id, request.leave_type, request.total_days ? Number(request.total_days) : 0);
    }

    const updated = await this.prisma.hr_time_off_requests.update({
      where: { id },
      data: { status: 'cancelled', deducted_from_balance: false },
      include: timeOffInclude,
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Request cancelled', mapTimeOff(updated));
  }

  async calendar(query: { start_date?: string; end_date?: string }) {
    return this.cached(this.cacheKey('calendar', JSON.stringify(query)), async () => {
    const start = parseDateOnly(query.start_date) || new Date();
    const end = parseDateOnly(query.end_date) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const requests = await this.prisma.hr_time_off_requests.findMany({
      where: {
        status: 'approved',
        start_date: { lte: end },
        end_date: { gte: start },
      },
      include: { employees_hr_time_off_requests_employee_idToemployees: { include: { profiles: profileSelect } } },
    });

    const events = requests.map((req) => {
      const emp = (req as any).employees_hr_time_off_requests_employee_idToemployees;
      const profile = emp?.profiles;
      const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : 'Unknown';
      return {
        id: req.id,
        title: `${name} - ${req.leave_type}`,
        start: req.start_date,
        end: req.end_date,
        leaveType: req.leave_type,
        employeeId: req.employee_id,
        employeeName: name,
      };
    });

    return buildLegacyDataEnvelope(events);
    });
  }

  async findOne(id: number) {
    return this.cached(this.cacheKey('detail', id), async () => {
    const request = await this.prisma.hr_time_off_requests.findUnique({ where: { id }, include: timeOffInclude });
    if (!request) throw new NotFoundException({ success: false, message: 'Request not found' });
    return buildLegacyDataEnvelope(mapTimeOff(request));
    });
  }

  private async findOneRaw(id: number) {
    const request = await this.prisma.hr_time_off_requests.findUnique({ where: { id } });
    if (!request) throw new NotFoundException({ success: false, message: 'Request not found' });
    return request;
  }

  private getLeaveBalance(employee: { annual_leave_balance: unknown; sick_leave_balance: unknown; personal_leave_balance: unknown }, leaveType: string) {
    const map: Record<string, unknown> = {
      annual: employee.annual_leave_balance,
      sick: employee.sick_leave_balance,
      personal: employee.personal_leave_balance,
    };
    return parseNumber(map[leaveType] ?? null);
  }

  private async adjustLeaveBalance(employeeId: number, leaveType: string, days: number) {
    const fieldMap: Record<string, string> = {
      annual: 'annual_leave_balance',
      sick: 'sick_leave_balance',
      personal: 'personal_leave_balance',
    };
    const field = fieldMap[leaveType];
    if (!field || !days) return;
    await this.prisma.employees.update({
      where: { id: employeeId },
      data: { [field]: { increment: days } },
    });
  }

  private async generateRequestNumber() {
    const year = new Date().getFullYear();
    const prefix = `LV-${year}-`;
    const count = await this.prisma.hr_time_off_requests.count({ where: { request_number: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }
}
