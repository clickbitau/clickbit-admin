import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';

const advanceInclude: any = {
  employees: { include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true, job_title: true } } } },
  profiles: { select: { id: true, first_name: true, last_name: true } },
  staff_advance_deductions: {
    include: { profiles: { select: { id: true, first_name: true, last_name: true } } },
    orderBy: [{ deduction_date: 'desc' as const }, { created_at: 'desc' as const }],
  },
};

function normalize(a: any) {
  const employee = a.employees ? { ...a.employees, user: a.employees.profiles } : null;
  const deductions = Array.isArray(a.staff_advance_deductions)
    ? a.staff_advance_deductions.map((d: any) => ({ ...d, user: d.profiles }))
    : a.staff_advance_deductions;
  return { ...a, employee, creator: a.profiles, deductions };
}

function toLocalDateStr(dt: Date | string) {
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class StaffAdvancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('staff-advances', ...parts) ?? `staff-advances:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  async findAll(query: Record<string, unknown>) {
    return this.cached(this.cacheKey('list', JSON.stringify(query)), async () => {
    const where: any = {};
    if (typeof query.status === 'string') where.status = query.status;
    if (query.employee_id) where.employee_id = Number(query.employee_id);
    if (typeof query.search === 'string' && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
        { employees: { profiles: { OR: [{ first_name: { contains: term, mode: 'insensitive' } }, { last_name: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }] } } },
      ];
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);

    const [rows, count] = await Promise.all([
      this.prisma.staff_advances.findMany({ where, include: advanceInclude, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.staff_advances.count({ where }),
    ]);

    const allActive = await this.prisma.staff_advances.findMany({ where: { status: 'active' }, select: { remaining_balance: true } });
    const allAll = await this.prisma.staff_advances.findMany({ where: { status: { not: { in: ['pending', 'rejected'] } } }, select: { total_amount: true, remaining_balance: true, status: true } });

    const stats = {
      totalOutstanding: allActive.reduce((s, a) => s + Number(a.remaining_balance || 0), 0),
      totalIssued: 0,
      totalRecovered: 0,
      activeCount: allActive.length,
      pendingCount: 0,
    };

    for (const a of allAll) {
      stats.totalIssued += Number(a.total_amount || 0);
      stats.totalRecovered += Number(a.total_amount || 0) - Number(a.remaining_balance || 0);
    }
    stats.pendingCount = await this.prisma.staff_advances.count({ where: { status: 'pending' } });

    return {
      success: true,
      data: rows.map(normalize),
      stats,
      pagination: { currentPage: page, totalPages: Math.ceil(count / limit), totalItems: count },
    };
    });
  }

  async findMe(userId: number) {
    return this.cached(this.cacheKey('me', userId), async () => {
    const emp = await this.prisma.employees.findUnique({ where: { user_id: userId } });
    if (!emp) throw new NotFoundException('No employee profile found');
    const rows = await this.prisma.staff_advances.findMany({
      where: { employee_id: emp.id },
      include: advanceInclude,
      orderBy: { created_at: 'desc' },
    });
    const totalOwed = rows.filter((a) => a.status === 'active').reduce((s, a) => s + Number(a.remaining_balance || 0), 0);
    return { success: true, data: rows.map(normalize), totalOwed };
    });
  }

  async checkEligibility(userId: number) {
    return this.cached(this.cacheKey('eligibility', userId), async () => {
    const emp = await this.prisma.employees.findUnique({ where: { user_id: userId } });
    if (!emp) throw new NotFoundException('No employee profile found');

    const contract = await this.prisma.hr_contracts.findFirst({ where: { employee_id: emp.id, status: 'active' }, orderBy: { start_date: 'desc' } });
    const payFrequency: any = contract?.pay_frequency || emp.pay_frequency || 'monthly';
    const salary = Number(contract?.salary || emp.salary || 0);

    const lastPayslip = await this.prisma.payslips.findFirst({
      where: { employee_id: emp.id, status: { in: ['generated', 'paid', 'sent'] } },
      orderBy: { pay_period_end: 'desc' },
    });

    if (!lastPayslip) {
      return { success: true, eligible: false, reason: 'no_payslip', message: 'No payslip found. Your first payslip must be issued before you can request a pay advance.', pay_frequency: payFrequency };
    }

    const { start: nextStart, end: nextEnd } = this.getNextPeriod(lastPayslip.pay_period_end, payFrequency);
    const existing = await this.prisma.staff_advances.findFirst({
      where: { employee_id: emp.id, is_pay_advance: true, pay_period_start: new Date(nextStart), status: { in: ['pending', 'active'] } },
    });

    const estimatedAmount = Number(lastPayslip.net_pay || 0) || salary / 12;

    return {
      success: true,
      eligible: !existing,
      reason: existing ? 'already_requested' : null,
      message: existing ? `You already have a ${existing.status} advance for this pay period.` : `You are eligible to request an advance for the period ${nextStart} to ${nextEnd}.`,
      pay_frequency: payFrequency,
      next_period_start: nextStart,
      next_period_end: nextEnd,
      last_payslip_end: toLocalDateStr(lastPayslip.pay_period_end),
      estimated_amount: estimatedAmount,
      payslip_currency: lastPayslip.currency || 'AUD',
      existing_advance: existing ? { id: existing.id, status: existing.status, total_amount: existing.total_amount } : null,
    };
    });
  }

  async request(userId: number, dto: any) {
    const emp = await this.prisma.employees.findUnique({ where: { user_id: userId }, include: { profiles: true } });
    if (!emp) throw new NotFoundException('No employee profile found');

    const { title, total_amount, advance_type, notes_employee, pay_period_start, pay_period_end, is_pay_advance } = dto;

    if (is_pay_advance && pay_period_start && pay_period_end) {
      const duplicate = await this.prisma.staff_advances.findFirst({
        where: { employee_id: emp.id, is_pay_advance: true, pay_period_start: new Date(pay_period_start), status: { in: ['pending', 'active'] } },
      });
      if (duplicate) throw new BadRequestException(`You already have a ${duplicate.status} pay advance for this period.`);
    }

    const finalTitle = title || (is_pay_advance && pay_period_start ? `Pay Advance – ${new Date(pay_period_start).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}` : 'Advance Request');
    if (!total_amount) throw new BadRequestException('total_amount is required');

    const advance = await this.prisma.staff_advances.create({
      data: {
        employee_id: emp.id,
        title: finalTitle,
        description: notes_employee || '',
        total_amount: new Decimal(total_amount),
        remaining_balance: new Decimal(total_amount),
        advance_type: advance_type || 'cash',
        advance_date: new Date(),
        notes_employee: notes_employee || '',
        pay_period_start: pay_period_start ? new Date(pay_period_start) : undefined,
        pay_period_end: pay_period_end ? new Date(pay_period_end) : undefined,
        is_pay_advance: !!is_pay_advance,
        status: 'pending',
        created_by: userId,
      },
      include: advanceInclude,
    });
    await this.invalidateCache();
    return { success: true, data: normalize(advance), message: 'Your advance request has been submitted and is pending approval.' };
  }

  async create(userId: number, dto: any) {
    if (!dto.employee_id || !dto.title || !dto.total_amount || !dto.advance_date) {
      throw new BadRequestException('employee_id, title, total_amount, and advance_date are required');
    }
    const advance = await this.prisma.staff_advances.create({
      data: {
        employee_id: Number(dto.employee_id),
        title: dto.title,
        description: dto.description,
        total_amount: new Decimal(dto.total_amount),
        remaining_balance: new Decimal(dto.total_amount),
        advance_type: dto.advance_type || 'asset',
        advance_date: new Date(dto.advance_date),
        notes: dto.notes,
        status: 'active',
        created_by: userId,
      },
      include: advanceInclude,
    });
    await this.invalidateCache();
    return { success: true, data: normalize(advance) };
  }

  async findOne(user: any, id: number) {
    return this.cached(this.cacheKey('detail', user.id, id), async () => {
    const advance = await this.prisma.staff_advances.findUnique({ where: { id }, include: advanceInclude });
    if (!advance) throw new NotFoundException('Advance not found');
    const role = String(user.role).toLowerCase();
    if (!['admin', 'manager'].includes(role) && (advance as any).employees?.user_id !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    return { success: true, data: normalize(advance) };
    });
  }

  async update(id: number, dto: any) {
    const advance = await this.prisma.staff_advances.findUnique({ where: { id } });
    if (!advance) throw new NotFoundException('Advance not found');
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.advance_type !== undefined) data.advance_type = dto.advance_type;
    if (dto.advance_date !== undefined) data.advance_date = new Date(dto.advance_date);
    const updated = await this.prisma.staff_advances.update({ where: { id }, data, include: advanceInclude });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { success: true, data: normalize(updated) };
  }

  async approve(userId: number, id: number) {
    const advance = await this.prisma.staff_advances.findUnique({ where: { id } });
    if (!advance) throw new NotFoundException('Advance not found');
    if (advance.status !== 'pending') throw new BadRequestException('Advance is not in pending status');
    const updated = await this.prisma.staff_advances.update({
      where: { id },
      data: { status: 'active', advance_date: new Date() },
      include: advanceInclude,
    });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { success: true, data: normalize(updated), message: 'Advance approved and is now active.' };
  }

  async reject(userId: number, id: number, reason?: string) {
    const advance = await this.prisma.staff_advances.findUnique({ where: { id } });
    if (!advance) throw new NotFoundException('Advance not found');
    if (advance.status !== 'pending') throw new BadRequestException('Advance is not in pending status');
    const data: any = { status: 'rejected' };
    if (reason) data.notes = reason;
    const updated = await this.prisma.staff_advances.update({ where: { id }, data, include: advanceInclude });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { success: true, data: normalize(updated), message: 'Advance request rejected.' };
  }

  async remove(id: number) {
    const advance = await this.prisma.staff_advances.findUnique({ where: { id }, include: { staff_advance_deductions: true } });
    if (!advance) throw new NotFoundException('Advance not found');
    await this.prisma.staff_advance_deductions.deleteMany({ where: { advance_id: id } });
    await this.prisma.staff_advances.delete({ where: { id } });
    await this.invalidateCache();
    return { success: true, message: 'Advance deleted' };
  }

  async addDeduction(userId: number, advanceId: number, dto: any) {
    const advance = await this.prisma.staff_advances.findUnique({ where: { id: advanceId } });
    if (!advance) throw new NotFoundException('Advance not found');
    if (advance.status === 'cleared') throw new BadRequestException('Advance is already cleared');
    if (!dto.amount || !dto.deduction_date) throw new BadRequestException('amount and deduction_date are required');

    const deduction = await this.prisma.staff_advance_deductions.create({
      data: {
        advance_id: advanceId,
        amount: new Decimal(dto.amount),
        deduction_date: new Date(dto.deduction_date),
        deduction_type: dto.deduction_type || 'pay_deduction',
        notes: dto.notes,
        created_by: userId,
      },
      include: { profiles: { select: { id: true, first_name: true, last_name: true } } },
    });

    const updated = await this.recalcBalance(advanceId);
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', advanceId));
    return { success: true, data: { ...deduction, user: deduction.profiles }, remainingBalance: updated.remaining_balance, status: updated.status };
  }

  async removeDeduction(advanceId: number, deductionId: number) {
    const deduction = await this.prisma.staff_advance_deductions.findFirst({ where: { id: deductionId, advance_id: advanceId } });
    if (!deduction) throw new NotFoundException('Deduction not found');
    await this.prisma.staff_advance_deductions.delete({ where: { id: deductionId } });
    const updated = await this.recalcBalance(advanceId);
    await this.invalidateCache();
    return { success: true, message: 'Deduction removed', remainingBalance: updated.remaining_balance, status: updated.status };
  }

  private async recalcBalance(advanceId: number) {
    const deductions = await this.prisma.staff_advance_deductions.findMany({ where: { advance_id: advanceId }, select: { amount: true } });
    const advance = await this.prisma.staff_advances.findUnique({ where: { id: advanceId }, select: { id: true, total_amount: true, remaining_balance: true, status: true } });
    if (!advance) throw new NotFoundException('Advance not found');
    const totalDeducted = deductions.reduce((s, d) => s + Number(d.amount), 0);
    const remaining = Math.max(0, Number(advance.total_amount) - totalDeducted);
    let status = advance.status;
    if (remaining <= 0 && advance.status === 'active') status = 'cleared';
    if (remaining > 0 && advance.status === 'cleared') status = 'active';
    return this.prisma.staff_advances.update({
      where: { id: advanceId },
      data: { remaining_balance: new Decimal(remaining), status },
      include: advanceInclude,
    });
  }

  private getNextPeriod(lastPeriodEnd: Date, frequency: string) {
    const dateStr = toLocalDateStr(lastPeriodEnd);
    const [y, mo, da] = dateStr.split('-').map(Number);
    const start = new Date(y, mo - 1, da + 1);
    let end: Date;
    if (frequency === 'monthly') {
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    } else if (frequency === 'fortnightly') {
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 13);
    } else {
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    }
    return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
  }
}
