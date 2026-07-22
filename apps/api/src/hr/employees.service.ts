import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { asJsonInput, buildLegacyDataEnvelope, buildLegacyListEnvelope, buildLegacyMessageEnvelope, parseNumber } from './hr-utils';
import { CacheService } from '../redis/cache.service';
import { StorageService } from '../storage/storage.service';

const employeeInclude = {
  profiles: {
    select: { id: true, first_name: true, last_name: true, email: true, avatar: true, phone: true, address: true, role: true },
  },
  employees: {
    select: {
      id: true,
      profiles: { select: { first_name: true, last_name: true, email: true } },
    },
  },
  departments: { select: { id: true, name: true } },
  employee_documents: true,
} as const;

function mapEmployee(employee: Prisma.employeesGetPayload<{ include: typeof employeeInclude }>) {
  const e = employee as unknown as Record<string, unknown>;
  return {
    ...e,
    user: e.profiles,
    manager: e.employees
      ? { ...e.employees, user: (e.employees as { profiles?: unknown }).profiles }
      : undefined,
    departmentInfo: e.departments,
    documents: e.employee_documents,
    profiles: undefined,
    employees: undefined,
    departments: undefined,
    employee_documents: undefined,
    default_weekly_hours: parseNumber(e.default_weekly_hours),
    hourly_rate: parseNumber(e.hourly_rate),
    salary: parseNumber(e.salary),
    annual_leave_balance: parseNumber(e.annual_leave_balance),
    sick_leave_balance: parseNumber(e.sick_leave_balance),
    personal_leave_balance: parseNumber(e.personal_leave_balance),
  };
}

function employeeListFields(includeManager = true) {
  const base = {
    profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true, phone: true, address: true, role: true } },
    departments: { select: { id: true, name: true } },
    employee_documents: true,
  } as const;
  if (includeManager) {
    return {
      ...base,
      employees: { select: { id: true, profiles: { select: { first_name: true, last_name: true, email: true } } } },
    } as const;
  }
  return base;
}

function parseDateOnly(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage?: StorageService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('employees', ...parts) ?? `employees:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
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

  async getDashboardStats(_user: Profile) {
    return this.cached(this.cacheKey('dashboard'), async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];

    const totalEmployees = await this.prisma.employees.count({ where: { deleted_at: null } });
    const activeEmployees = await this.prisma.employees.count({ where: { employment_status: 'active', deleted_at: null } });
    const clockedInCount = await this.prisma.hr_time_entries.count({ where: { clock_out_time: null } });
    const pendingTimeOff = await this.prisma.hr_time_off_requests.count({ where: { status: 'pending' } });
    const todayShifts = await this.prisma.hr_shifts.count({ where: { shift_date: { gte: today, lt: tomorrow } } });
    const onLeaveToday = await this.prisma.hr_time_off_requests.count({
      where: {
        status: 'approved',
        start_date: { lte: parseDateOnly(todayStr) },
        end_date: { gte: parseDateOnly(todayStr) },
      },
    });

    const departmentStats = await this.prisma.employees.groupBy({
      by: ['department'],
      where: { employment_status: 'active', deleted_at: null },
      _count: { id: true },
    });

    const recentAnnouncements = await this.prisma.hr_announcements.findMany({
      where: { status: 'published' },
      orderBy: { publish_at: 'desc' },
      take: 5,
      include: { profiles: { select: { id: true, first_name: true, last_name: true, avatar: true } } },
    });

    const clockedInEntries = await this.prisma.hr_time_entries.findMany({
      where: { clock_out_time: null },
      include: {
        employees: {
          include: {
            profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
          },
        },
      },
      orderBy: { clock_in_time: 'desc' },
    });

    const clockedInEmployees = clockedInEntries.map((entry) => {
      const emp = entry.employees;
      const profile = emp?.profiles;
      const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : 'Unknown Employee';
      return {
        id: emp?.id,
        name,
        email: profile?.email,
        avatar_url: profile?.avatar || null,
        clockInTime: entry.clock_in_time,
        department: emp?.department || 'Unassigned',
      };
    });

    return {
      success: true,
      data: {
        stats: {
          totalEmployees,
          activeEmployees,
          clockedInCount,
          pendingTimeOff,
          todayShifts,
          overdueTimeEntries: 0,
          onLeaveToday,
        },
        departmentStats: departmentStats.map((d) => ({
          department: d.department || 'Unassigned',
          count: d._count.id,
        })),
        recentAnnouncements,
        clockedInEmployees,
      },
    };
    });
  }

  async getStats(_user: Profile) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    const [
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      terminatedEmployees,
      departmentStats,
      typeStats,
      totalContracts,
      activeContracts,
      expiredContracts,
      expiringSoonContracts,
      totalTimeOff,
      pendingTimeOff,
      approvedTimeOff,
      rejectedTimeOff,
      totalTimeEntries,
      activeTimeEntries,
      completedTimeEntries,
      approvedTimeEntries,
      rejectedTimeEntries,
      totalShifts,
      todayShifts,
      upcomingShifts,
      completedShifts,
      cancelledShifts,
      totalPayslips,
      draftPayslips,
      generatedPayslips,
      paidPayslips,
      sentPayslips,
      activeClockIn,
      completedClockInToday,
      totalAnnouncements,
      publishedAnnouncements,
      scheduledAnnouncements,
      draftAnnouncements,
      totalReminders,
      pendingReminders,
      completeReminders,
      totalPublicHolidays,
      upcomingPublicHolidays,
    ] = await Promise.all([
      this.prisma.employees.count({ where: { deleted_at: null } }),
      this.prisma.employees.count({ where: { employment_status: 'active', deleted_at: null } }),
      this.prisma.employees.count({ where: { employment_status: 'on_leave', deleted_at: null } }),
      this.prisma.employees.count({ where: { employment_status: 'terminated', deleted_at: null } }),
      this.prisma.employees.groupBy({ by: ['department'], where: { deleted_at: null }, _count: { id: true } }),
      this.prisma.employees.groupBy({ by: ['employment_type'], where: { deleted_at: null }, _count: { id: true } }),
      this.prisma.hr_contracts.count(),
      this.prisma.hr_contracts.count({ where: { status: 'active' } }),
      this.prisma.hr_contracts.count({ where: { status: 'expired' } }),
      this.prisma.hr_contracts.count({ where: { status: 'active', end_date: { gte: today, lt: in30Days } } }),
      this.prisma.hr_time_off_requests.count(),
      this.prisma.hr_time_off_requests.count({ where: { status: 'pending' } }),
      this.prisma.hr_time_off_requests.count({ where: { status: 'approved' } }),
      this.prisma.hr_time_off_requests.count({ where: { status: 'rejected' } }),
      this.prisma.hr_time_entries.count(),
      this.prisma.hr_time_entries.count({ where: { status: 'active' } }),
      this.prisma.hr_time_entries.count({ where: { status: 'completed' } }),
      this.prisma.hr_time_entries.count({ where: { status: 'approved' } }),
      this.prisma.hr_time_entries.count({ where: { status: 'rejected' } }),
      this.prisma.hr_shifts.count(),
      this.prisma.hr_shifts.count({ where: { shift_date: { gte: today, lt: tomorrow }, status: { not: 'cancelled' } } }),
      this.prisma.hr_shifts.count({ where: { shift_date: { gte: tomorrow }, status: { not: 'cancelled' } } }),
      this.prisma.hr_shifts.count({ where: { status: 'completed' } }),
      this.prisma.hr_shifts.count({ where: { status: 'cancelled' } }),
      this.prisma.payslips.count(),
      this.prisma.payslips.count({ where: { status: 'draft' } }),
      this.prisma.payslips.count({ where: { status: 'generated' } }),
      this.prisma.payslips.count({ where: { status: 'paid' } }),
      this.prisma.payslips.count({ where: { status: 'sent' } }),
      this.prisma.hr_time_entries.count({ where: { clock_out_time: null } }),
      this.prisma.hr_time_entries.count({ where: { clock_out_time: { not: null }, clock_in_time: { gte: today, lt: tomorrow } } }),
      this.prisma.hr_announcements.count(),
      this.prisma.hr_announcements.count({ where: { status: 'published' } }),
      this.prisma.hr_announcements.count({ where: { status: 'scheduled' } }),
      this.prisma.hr_announcements.count({ where: { status: 'draft' } }),
      this.prisma.hr_reminders.count(),
      this.prisma.hr_reminders.count({ where: { status: 'pending' } }),
      this.prisma.hr_reminders.count({ where: { status: 'complete' } }),
      this.prisma.hr_public_holidays.count(),
      this.prisma.hr_public_holidays.count({ where: { holiday_date: { gte: today } } }),
    ]);

    return {
      success: true,
      data: {
        employees: {
          total: totalEmployees,
          active: activeEmployees,
          onLeave: onLeaveEmployees,
          terminated: terminatedEmployees,
          byDepartment: departmentStats.map((d) => ({ department: d.department || 'Unassigned', count: d._count.id })),
          byType: typeStats.map((t) => ({ type: t.employment_type || 'Unspecified', count: t._count.id })),
        },
        contracts: { total: totalContracts, active: activeContracts, expired: expiredContracts, expiringSoon: expiringSoonContracts },
        timeOff: { total: totalTimeOff, pending: pendingTimeOff, approved: approvedTimeOff, rejected: rejectedTimeOff },
        timesheets: { total: totalTimeEntries, active: activeTimeEntries, completed: completedTimeEntries, approved: approvedTimeEntries, rejected: rejectedTimeEntries },
        shifts: { total: totalShifts, today: todayShifts, upcoming: upcomingShifts, completed: completedShifts, cancelled: cancelledShifts },
        payslips: { total: totalPayslips, draft: draftPayslips, generated: generatedPayslips, paid: paidPayslips, sent: sentPayslips },
        timeClock: { active: activeClockIn, completedToday: completedClockInToday },
        announcements: { total: totalAnnouncements, published: publishedAnnouncements, scheduled: scheduledAnnouncements, draft: draftAnnouncements },
        reminders: { total: totalReminders, pending: pendingReminders, complete: completeReminders },
        publicHolidays: { total: totalPublicHolidays, upcoming: upcomingPublicHolidays },
      },
    };
  }

  async getEmployeeDashboard(user: Profile) {
    return this.cached(this.cacheKey('employee-dashboard', user.id), async () => {
    const employee = await this.prisma.employees.findFirst({
      where: { user_id: user.id, deleted_at: null },
      include: {
        profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true, phone: true, address: true } },
        employees: { select: { id: true, profiles: { select: { first_name: true, last_name: true, email: true } } } },
      },
    });

    if (!employee) {
      throw new NotFoundException({ success: false, message: 'Employee profile not found. Please contact HR to set up your profile.' });
    }

    const PERTH_TZ = 'Australia/Perth';
    const perthDateStr = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: PERTH_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const perthRange = (dateStr: string) => ({
      start: new Date(`${dateStr}T00:00:00+08:00`),
      end: new Date(`${dateStr}T23:59:59.999+08:00`),
    });
    const minutesBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 60000);
    const durationMinutes = (entry: { clock_in_time: Date; clock_out_time?: Date | null; break_minutes?: number | null }) => {
      const end = entry.clock_out_time || new Date();
      return Math.max(0, minutesBetween(entry.clock_in_time, end) - (entry.break_minutes || 0));
    };
    const hoursFromEntries = (entries: { clock_in_time: Date; clock_out_time?: Date | null; break_minutes?: number | null; total_minutes?: number | null }[]) =>
      entries.reduce((sum, e) => sum + (e.total_minutes ?? durationMinutes(e)), 0) / 60;

    const today = perthDateStr();
    const { start: todayStart, end: todayEnd } = perthRange(today);
    const now = new Date();
    const day = now.getUTCDay();
    const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setUTCDate(diff);
    monday.setUTCHours(0, 0, 0, 0);
    const [
      upcomingShifts,
      timeOffRequests,
      activeEntry,
      todayEntries,
      weeklyEntries,
      activeTaskCount,
      countUp,
      countPending,
      announcements,
    ] = await Promise.all([
      this.prisma.hr_shifts.findMany({
        where: { employee_id: employee.id, shift_date: { gte: parseDateOnly(today) } },
        orderBy: [{ shift_date: 'asc' }, { start_time: 'asc' }],
        take: 5,
      }),
      this.prisma.hr_time_off_requests.findMany({
        where: { employee_id: employee.id, status: 'pending' },
        orderBy: { submitted_at: 'desc' },
        take: 5,
      }),
      this.prisma.hr_time_entries.findFirst({
        where: { employee_id: employee.id, clock_out_time: null },
        orderBy: { clock_in_time: 'desc' },
      }),
      this.prisma.hr_time_entries.findMany({
        where: { employee_id: employee.id, clock_in_time: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.hr_time_entries.findMany({
        where: { employee_id: employee.id, clock_in_time: { gte: monday } },
      }),
      this.prisma.project_tasks.count({
        where: { assigned_to: user.id, deleted_at: null, status: { not: 'completed' } },
      }),
      this.prisma.hr_shifts.count({
        where: { employee_id: employee.id, shift_date: { gte: parseDateOnly(today) }, status: { notIn: ['cancelled'] } },
      }),
      this.prisma.hr_time_off_requests.count({
        where: { employee_id: employee.id, status: 'pending' },
      }),
      this.prisma.hr_announcements.findMany({
        where: {
          status: 'published',
          OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        },
        orderBy: [{ is_pinned: 'desc' as const }, { pin_order: 'asc' as const }, { publish_at: 'desc' as const }],
        take: 5,
        include: { profiles: { select: { id: true, first_name: true, last_name: true, avatar: true } } },
      }),
    ]);

    const todayHours = hoursFromEntries(todayEntries);
    const weeklyHours = hoursFromEntries(weeklyEntries);
    const mappedAnnouncements = announcements.map((a: any) => ({ ...a, author: a.profiles, profiles: undefined }));
    const mappedEmployee = mapEmployee(await this.findOneWithInclude(employee.id));

    return {
      success: true,
      data: {
        ...mappedEmployee,
        shifts: upcomingShifts,
        announcements: mappedAnnouncements,
        timeOffRequests,
        countUp,
        countPending,
        todayHours,
        weeklyHours,
        activeEntry,
        activeTaskCount,
        activeTasks: activeTaskCount,
        pendingLeave: countPending,
        pendingTimeOff: countPending,
        stats: {
          isClockedIn: !!activeEntry,
          hoursToday: todayHours,
          hoursLogged: weeklyHours,
          weeklyHours,
          activeTasks: activeTaskCount,
          activeTaskCount,
          pendingLeave: countPending,
          pendingTimeOff: countPending,
          upcomingShifts: countUp,
          countUp,
          countPending,
          annualLeaveBalance: parseNumber(mappedEmployee.annual_leave_balance),
          sickLeaveBalance: parseNumber(mappedEmployee.sick_leave_balance),
          personalLeaveBalance: parseNumber(mappedEmployee.personal_leave_balance),
        },
      },
    };
    });
  }

  private async findOneWithInclude(id: number) {
    return this.prisma.employees.findUniqueOrThrow({
      where: { id, deleted_at: null },
      include: employeeInclude,
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: string;
    department?: string;
    employment_type?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }, user: Profile) {
    return this.cached(this.cacheKey('list', user.id, user.role, JSON.stringify(query)), async () => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    if (!this.isAdminOrManager(user)) {
      const emp = await this.prisma.employees.findFirst({
        where: { user_id: user.id, deleted_at: null },
        include: employeeInclude,
      });
      const items = emp ? [mapEmployee(emp)] : [];
      return buildLegacyListEnvelope(items, emp ? 1 : 0, 1, limit);
    }

    const where: Prisma.employeesWhereInput = { deleted_at: null };
    if (query.status) where.employment_status = query.status as any;
    if (query.department) where.department = query.department;
    if (query.employment_type) where.employment_type = query.employment_type as any;

    if (query.search) {
      where.OR = [
        { employee_number: { contains: query.search, mode: 'insensitive' } },
        { department: { contains: query.search, mode: 'insensitive' } },
        { position: { contains: query.search, mode: 'insensitive' } },
        {
          profiles: {
            OR: [
              { first_name: { contains: query.search, mode: 'insensitive' } },
              { last_name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const orderBy: Prisma.employeesOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'hire_date';
    const sortDir = query.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    (orderBy as any)[sortField] = sortDir;

    const [total, rows] = await Promise.all([
      this.prisma.employees.count({ where }),
      this.prisma.employees.findMany({
        where,
        include: employeeListFields(true),
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const mapped = rows.map((e) => mapEmployee(e as Prisma.employeesGetPayload<{ include: typeof employeeInclude }>));
    return buildLegacyListEnvelope(mapped, total, page, limit);
    });
  }

  async findMe(user: Profile) {
    return this.cached(this.cacheKey('me', user.id), async () => {
    const employee = await this.prisma.employees.findFirst({
      where: { user_id: user.id, deleted_at: null },
      include: employeeInclude,
    });
    if (!employee) throw new NotFoundException({ success: false, message: 'Employee profile not found' });
    return buildLegacyDataEnvelope(mapEmployee(employee));
    });
  }

  async findOne(id: number, user: Profile) {
    return this.cached(this.cacheKey('detail', user.id, id), async () => {
    const employee = await this.findOneWithInclude(id);
    const isOwner = employee.user_id === user.id;
    if (!this.isAdminOrManager(user) && !isOwner) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to view this employee profile' });
    }

    const [contracts, timeEntries, timeOffRequests, payslips, shifts, staffAdvances, kpiScores] = await Promise.all([
      this.prisma.hr_contracts.findMany({ where: { employee_id: id }, orderBy: { created_at: 'desc' }, take: 10 }),
      this.prisma.hr_time_entries.findMany({ where: { employee_id: id }, orderBy: { clock_in_time: 'desc' }, take: 10 }),
      this.prisma.hr_time_off_requests.findMany({ where: { employee_id: id }, orderBy: { submitted_at: 'desc' }, take: 10 }),
      this.prisma.payslips.findMany({ where: { employee_id: id }, orderBy: { payment_date: 'desc' }, take: 10 }),
      this.prisma.hr_shifts.findMany({ where: { employee_id: id }, orderBy: [{ shift_date: 'desc' }, { start_time: 'desc' }], take: 10 }),
      this.prisma.staff_advances.findMany({ where: { employee_id: id }, orderBy: { created_at: 'desc' }, take: 10 }),
      this.prisma.hr_kpi_scores.findMany({ where: { employee_id: id }, orderBy: { period: 'desc' }, take: 12 }),
    ]);

    const activeEntry = await this.prisma.hr_time_entries.findFirst({
      where: { employee_id: id, clock_out_time: null },
      orderBy: { clock_in_time: 'desc' },
    });

    return {
      success: true,
      data: {
        ...mapEmployee(employee),
        contracts,
        timeEntries,
        timeOffRequests,
        payslips,
        shifts,
        staffAdvances,
        kpiScores,
        activeEntry,
        isWorking: !!activeEntry,
        todayHours: 0,
        weeklyHours: 0,
      },
    };
    });
  }

  async create(dto: Record<string, unknown>, _user: Profile) {
    const userId = Number(dto.user_id);
    const existing = await this.prisma.employees.findUnique({ where: { user_id: userId } });
    if (existing) throw new BadRequestException({ success: false, message: 'Employee profile already exists for this user' });

    const profile = await this.prisma.profiles.findUnique({ where: { id: userId } });
    if (!profile) throw new BadRequestException({ success: false, message: 'Profile not found' });

    const data: Prisma.employeesUncheckedCreateInput = {
      ...this.buildEmployeeInput(dto),
      user_id: userId,
    };

    const created = await this.prisma.employees.create({
      data,
      include: employeeInclude,
    });

    if (dto.phone || dto.address) {
      const profileUpdates: Prisma.profilesUpdateInput = {};
      if (dto.phone) profileUpdates.phone = dto.phone;
      if (dto.address) {
        const address = dto.address as Record<string, string>;
        profileUpdates.address = JSON.stringify({
          street: address.street || address.address || (data as any).address,
          city: address.city || (data as any).city,
          state: address.state || (data as any).state,
          postal_code: address.postal_code || address.postcode || (data as any).postcode,
          country: address.country || (data as any).country,
        });
      }
      if (Object.keys(profileUpdates).length) {
        await this.prisma.profiles.update({ where: { id: userId }, data: profileUpdates });
      }
    }

    await this.invalidateCache();
    return buildLegacyDataEnvelope(mapEmployee(created));
  }

  async update(id: number, dto: Record<string, unknown>, user: Profile) {
    const employee = await this.findOneWithInclude(id);
    const isOwner = employee.user_id === user.id;
    if (!this.isAdminOrManager(user) && !isOwner) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to update this employee profile' });
    }
    const data = this.buildEmployeeInput(dto);
    const updated = await this.prisma.employees.update({
      where: { id },
      data: data as any,
      include: employeeInclude,
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', user.id, id));
    return buildLegacyDataEnvelope(mapEmployee(updated));
  }

  async sync(_user: Profile) {
    const profilesWithoutEmployee = await this.prisma.profiles.findMany({
      where: { role: { in: ['employee', 'manager'] }, status: 'active', employees: null },
      select: { id: true },
    });

    const created = await Promise.all(
      profilesWithoutEmployee.map(async (profile) => {
        return this.prisma.employees.create({
          data: {
            user_id: profile.id,
            employment_type: 'full_time',
            employment_status: 'active',
            pay_frequency: 'fortnightly',
            default_weekly_hours: 38,
            annual_leave_balance: 0,
            sick_leave_balance: 0,
            personal_leave_balance: 0,
            can_clock_in: true,
            require_gps_clock_in: false,
            require_photo_clock_in: false,
            auto_clock_in: false,
            tax_free_threshold_claimed: true,
            currency: 'AUD',
            location: 'Australia',
            timezone: 'Australia/Perth',
            country: 'Australia',
            is_demo: false,
          },
          include: employeeInclude,
        });
      }),
    );

    await this.invalidateCache();
    return buildLegacyDataEnvelope({ synced: created.length, employees: created.map(mapEmployee) });
  }

  async remove(id: number, user: Profile) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({ success: false, message: 'Only admins can delete employees' });
    }
    await this.findOneWithInclude(id);
    await this.prisma.employees.update({ where: { id }, data: { deleted_at: new Date() } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', user.id, id));
    return buildLegacyMessageEnvelope('Employee deleted successfully');
  }

  async getDocuments(employeeId: number, user: Profile) {
    const employee = await this.prisma.employees.findUnique({ where: { id: employeeId, deleted_at: null } });
    if (!employee) throw new NotFoundException({ success: false, message: 'Employee not found' });
    const isOwner = employee.user_id === user.id;
    if (!this.isAdminOrManager(user) && !isOwner) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to view these documents' });
    }
    const documents = await this.prisma.employee_documents.findMany({
      where: { employee_id: employeeId },
      orderBy: { created_at: 'desc' },
    });
    return buildLegacyDataEnvelope(documents);
  }

  async deleteDocument(employeeId: number, docId: number, user: Profile) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({ success: false, message: 'Only admins can delete employee documents' });
    }
    const doc = await this.prisma.employee_documents.findUnique({ where: { id: docId } });
    if (!doc || doc.employee_id !== employeeId) {
      throw new NotFoundException({ success: false, message: 'Document not found' });
    }
    await this.prisma.employee_documents.delete({ where: { id: docId } });
    await this.invalidateCache();
    return buildLegacyMessageEnvelope('Document deleted');
  }

  async addDocument(
    employeeId: number,
    file: Express.Multer.File,
    body: { name?: string; description?: string; category?: string },
    user: Profile,
  ) {
    const employee = await this.prisma.employees.findUnique({ where: { id: employeeId, deleted_at: null } });
    if (!employee) throw new NotFoundException({ success: false, message: 'Employee not found' });
    if (!this.isAdminOrManager(user) && employee.user_id !== user.id) {
      throw new ForbiddenException({ success: false, message: 'Not authorized to add documents' });
    }
    if (!file) throw new BadRequestException({ success: false, message: 'No file uploaded' });

    let fileUrl: string;
    if (this.storage?.isConfigured()) {
      const upload = await this.storage.upload(file.buffer, 'documents', file.originalname, file.mimetype, `employee-${employeeId}`);
      if (!upload.success) {
        throw new BadRequestException({ success: false, message: upload.error || 'Failed to upload file' });
      }
      fileUrl = upload.url;
    } else {
      fileUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }

    const document = await this.prisma.employee_documents.create({
      data: {
        employee_id: employeeId,
        name: body.name || file.originalname,
        description: body.description || null,
        file_url: fileUrl,
        file_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype,
        category: body.category || 'other',
        uploaded_by: user.id,
        status: 'active',
      } as any,
    });

    await this.invalidateCache();
    return buildLegacyDataEnvelope(document);
  }

  private buildEmployeeInput(dto: Record<string, unknown>): Record<string, unknown> {
    const input: Record<string, unknown> = {};

    if (dto.employee_number !== undefined) input.employee_number = dto.employee_number;
    if (dto.employment_type !== undefined) input.employment_type = dto.employment_type;
    if (dto.employment_status !== undefined) input.employment_status = dto.employment_status;
    if (dto.department !== undefined) input.department = dto.department;
    if (dto.position !== undefined) input.position = dto.position;
    if (dto.manager_id !== undefined) input.manager_id = dto.manager_id ? Number(dto.manager_id) : null;
    if (dto.hire_date !== undefined) input.hire_date = parseDateOnly(dto.hire_date as string);
    if (dto.termination_date !== undefined) input.termination_date = parseDateOnly(dto.termination_date as string);
    if (dto.department_id !== undefined) input.department_id = dto.department_id ? Number(dto.department_id) : null;
    if (dto.default_weekly_hours !== undefined) input.default_weekly_hours = Number(dto.default_weekly_hours) || 38;
    if (dto.hourly_rate !== undefined) input.hourly_rate = dto.hourly_rate ? Number(dto.hourly_rate) : null;
    if (dto.salary !== undefined) input.salary = dto.salary ? Number(dto.salary) : null;
    if (dto.pay_frequency !== undefined) input.pay_frequency = dto.pay_frequency;
    if (dto.annual_leave_balance !== undefined) input.annual_leave_balance = Number(dto.annual_leave_balance) || 0;
    if (dto.sick_leave_balance !== undefined) input.sick_leave_balance = Number(dto.sick_leave_balance) || 0;
    if (dto.personal_leave_balance !== undefined) input.personal_leave_balance = Number(dto.personal_leave_balance) || 0;
    if (dto.can_clock_in !== undefined) input.can_clock_in = Boolean(dto.can_clock_in);
    if (dto.require_gps_clock_in !== undefined) input.require_gps_clock_in = Boolean(dto.require_gps_clock_in);
    if (dto.require_photo_clock_in !== undefined) input.require_photo_clock_in = Boolean(dto.require_photo_clock_in);
    if (dto.auto_clock_in !== undefined) input.auto_clock_in = Boolean(dto.auto_clock_in);
    if (dto.abn !== undefined) input.abn = dto.abn;
    if (dto.tax_free_threshold_claimed !== undefined) input.tax_free_threshold_claimed = Boolean(dto.tax_free_threshold_claimed);
    if (dto.currency !== undefined) input.currency = dto.currency;
    if (dto.location !== undefined) input.location = dto.location;
    if (dto.timezone !== undefined) input.timezone = dto.timezone;
    if (dto.notes !== undefined) input.notes = dto.notes;
    if (dto.date_of_birth !== undefined) input.date_of_birth = parseDateOnly(dto.date_of_birth as string);
    if (dto.tax_file_number !== undefined) input.tax_file_number = dto.tax_file_number;
    if (dto.super_fund_name !== undefined) input.super_fund_name = dto.super_fund_name;
    if (dto.super_member_number !== undefined) input.super_member_number = dto.super_member_number;
    if (dto.bank_account_name !== undefined) input.bank_account_name = dto.bank_account_name;
    if (dto.bank_bsb !== undefined) input.bank_bsb = dto.bank_bsb;
    if (dto.bank_account_number !== undefined) input.bank_account_number = dto.bank_account_number;
    if (dto.emergency_contact_name !== undefined) input.emergency_contact_name = dto.emergency_contact_name;
    if (dto.emergency_contact_phone !== undefined) input.emergency_contact_phone = dto.emergency_contact_phone;
    if (dto.emergency_contact_relationship !== undefined) input.emergency_contact_relationship = dto.emergency_contact_relationship;

    if (dto.address && typeof dto.address === 'object' && !Array.isArray(dto.address)) {
      const address = dto.address as Record<string, string>;
      input.address = address.street || input.address;
      input.city = address.city || input.city;
      input.state = address.state || input.state;
      input.postcode = address.postal_code || address.postcode || input.postcode;
      input.country = address.country || input.country;
    } else {
      if (dto.address_street !== undefined) input.address = dto.address_street;
      if (dto.city_value !== undefined) input.city = dto.city_value;
      if (dto.state_value !== undefined) input.state = dto.state_value;
      if (dto.postcode_value !== undefined) input.postcode = dto.postcode_value;
      if (dto.country_value !== undefined) input.country = dto.country_value;
    }

    if (dto.skills !== undefined) input.skills = asJsonInput(dto.skills);
    if (dto.certifications !== undefined) input.certifications = asJsonInput(dto.certifications);
    if (dto.custom_fields !== undefined) input.custom_fields = asJsonInput(dto.custom_fields);
    if (dto.work_schedule !== undefined) input.work_schedule = asJsonInput(dto.work_schedule);
    if (dto.allowed_clock_in_locations !== undefined) input.allowed_clock_in_locations = asJsonInput(dto.allowed_clock_in_locations);

    return input;
  }
}
