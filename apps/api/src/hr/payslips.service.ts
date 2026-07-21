import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { PdfTemplatesService } from '../settings/pdf-templates.service';
import { generatePayslipPDF } from '../common/pdf/payslip-pdf';

interface UserLike {
  id: number;
  role: string;
}

interface PayslipLineItem {
  description: string;
  quantity?: number;
  rate?: number;
  amount: string;
  type: 'earning';
}

export interface PayslipCalcResult {
  employee_id: number;
  pay_period_start: Date;
  pay_period_end: Date;
  payment_date: Date;
  pay_frequency: string;
  currency: string;
  gross_pay: number;
  tax_withheld: number;
  superannuation: number;
  net_pay: number;
  ytd_gross: number;
  ytd_tax: number;
  ytd_super: number;
  line_items: PayslipLineItem[];
  leave_data: Record<string, unknown>;
  status: string;
  employee_name?: string;
  timesheet_hours?: number;
  is_overdue?: boolean;
}

const SICK_LEAVE_ENTITLEMENT_HOURS = 76;

// ATO Stage 3 2024-25 Scale 2 (Tax Free Threshold Claimed)
const SCALE_2_WEEKLY = [
  { limit: 359, a: 0, b: 0 },
  { limit: 865, a: 0.16, b: 57.4038 },
  { limit: 2596, a: 0.3, b: 178.5576 },
  { limit: 3653, a: 0.37, b: 360.3076 },
  { limit: 999999, a: 0.45, b: 652.5961 },
];

@Injectable()
export class PayslipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfTemplatesService: PdfTemplatesService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('payslips', ...parts) ?? `payslips:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  async findMyPayslips(_user: UserLike) {
    const cacheKey = this.cacheKey('my', _user.id);
    return this.cache?.getOrSet(cacheKey, () => this.fetchFindMyPayslips(_user), this.CACHE_TTL_SECONDS) ?? this.fetchFindMyPayslips(_user);
  }

  private async fetchFindMyPayslips(_user: UserLike) {
    const emp = await this.prisma.employees.findFirst({ where: { user_id: _user.id } });
    if (!emp) return [];

    const rows = await this.prisma.payslips.findMany({
      where: { employee_id: emp.id },
      include: { employees: { include: { profiles: { select: { first_name: true, last_name: true, email: true } } } } },
      orderBy: { payment_date: 'desc' },
    });
    return rows.map((p) => this.mapPayslip(p));
  }

  async findPayslips(query: Record<string, unknown>, _user: UserLike) {
    const cacheKey = this.cacheKey('list', _user.id, _user.role, JSON.stringify(query));
    return this.cache?.getOrSet(cacheKey, () => this.fetchFindPayslips(query, _user), this.CACHE_TTL_SECONDS) ?? this.fetchFindPayslips(query, _user);
  }

  private async fetchFindPayslips(query: Record<string, unknown>, _user: UserLike) {
    const where: Prisma.payslipsWhereInput = {};
    const employeeId = this.asNumber(query.employee_id);
    if (employeeId) where.employee_id = employeeId;

    const status = this.asString(query.status);
    if (status && status !== 'all') {
      where.status = status as any;
    }

    if (query.start_date) {
      const d = this.parseDate(query.start_date);
      if (d) where.pay_period_start = { gte: d };
    }
    if (query.end_date) {
      const d = this.parseDate(query.end_date);
      if (d) where.pay_period_end = { lte: d };
    }

    const year = this.asString(query.year);
    if (year && year !== 'all') {
      const fyYear = parseInt(year, 10);
      const fyStart = new Date(fyYear - 1, 6, 1);
      const fyEnd = new Date(fyYear, 5, 30, 23, 59, 59, 999);
      where.pay_period_end = { gte: fyStart, lte: fyEnd };
    }

    const search = this.asString(query.search);
    const include: Prisma.payslipsInclude = {
      employees: {
        include: {
          profiles: { select: { first_name: true, last_name: true, email: true, avatar: true } },
        },
      },
    };

    let rows: any[] = [];
    if (search) {
      const employees = await this.prisma.employees.findMany({
        where: {
          profiles: {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        select: { id: true },
      });
      const ids = employees.map((e) => e.id);
      if (ids.length === 0) return { success: true, data: [], pagination: { total: 0, page: 1, pages: 0 } };
      where.employee_id = { in: ids };
      rows = await this.prisma.payslips.findMany({ where, include, orderBy: { payment_date: 'desc' } });
    } else {
      const page = this.asNumber(query.page) ?? 1;
      const limit = this.asNumber(query.limit) ?? 20;
      const [data, count] = await Promise.all([
        this.prisma.payslips.findMany({ where, include, orderBy: { payment_date: 'desc' }, skip: (page - 1) * limit, take: limit }),
        this.prisma.payslips.count({ where }),
      ]);
      rows = data;
      return {
        success: true,
        data: rows.map((p) => this.mapPayslip(p)),
        pagination: { total: count, page, pages: Math.ceil(count / limit) },
      };
    }

    return { success: true, data: rows.map((p) => this.mapPayslip(p)) };
  }

  async findOne(id: number, user: UserLike) {
    const cacheKey = this.cacheKey('detail', user.id, id);
    return this.cache?.getOrSet(cacheKey, () => this.fetchFindOne(id, user), this.CACHE_TTL_SECONDS) ?? this.fetchFindOne(id, user);
  }

  private async fetchFindOne(id: number, user: UserLike) {
    const payslip = await this.prisma.payslips.findUnique({
      where: { id },
      include: {
        employees: {
          include: {
            profiles: { select: { first_name: true, last_name: true, email: true, avatar: true } },
          },
        },
      },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');

    if (user.role !== 'admin' && user.role !== 'manager') {
      const emp = await this.prisma.employees.findFirst({ where: { user_id: user.id } });
      if (!emp || payslip.employee_id !== emp.id) {
        throw new ForbiddenException('Not authorized to view this payslip');
      }
    }

    return { success: true, data: this.mapPayslip(payslip) };
  }

  async calculateSingle(dto: Record<string, unknown>, user: UserLike) {
    const employeeId = this.asNumber(dto.employeeId);
    if (!employeeId) throw new BadRequestException('employeeId is required');
    const employee = await this.getEmployeeWithProfile(employeeId);
    if (!employee) throw new NotFoundException('Employee not found');
    this.ensureAdminOrManagerOrSelf(user, employee.user_id);

    const start = this.parseDate(dto.periodStart);
    const end = this.parseDate(dto.periodEnd);
    const paymentDate = this.parseDate(dto.paymentDate);
    if (!start || !end || !paymentDate) throw new BadRequestException('Valid periodStart, periodEnd and paymentDate are required');

    const manualHours = this.asNumber(dto.manualHours);
    const result = await this.generatePayslipData(employee, start, end, paymentDate, { manualHours });
    result.employee_name = employee.profiles ? `${employee.profiles.first_name} ${employee.profiles.last_name}` : 'Unknown Employee';
    return { success: true, data: result };
  }

  async nextPayRun(user: UserLike) {
    this.ensureAdminOrManager(user);
    const duePeriods = await this.getNextPayPeriods();
    if (duePeriods.length === 0) {
      return { success: true, data: [], message: 'No payslips are due at this time.' };
    }

    const workItems: { employee: any; period: { start: Date; end: Date; paymentDate: Date } }[] = [];
    const employeeIds = new Set<number>();
    let globalStart: Date | null = null;
    let globalEnd: Date | null = null;

    for (const { employee, periods } of duePeriods) {
      if (employee.employment_type === 'contractor') continue;
      for (const period of periods) {
        workItems.push({ employee, period });
        employeeIds.add(employee.id);
        if (!globalStart || period.start < globalStart) globalStart = period.start;
        if (!globalEnd || period.end > globalEnd) globalEnd = period.end;
      }
    }

    if (workItems.length === 0) {
      return { success: true, data: [], message: 'No payslips are due at this time.' };
    }

    const employeeIdArr = Array.from(employeeIds);
    const [timeEntries, approvedLeave] = await Promise.all([
      this.prisma.hr_time_entries.findMany({
        where: {
          employee_id: { in: employeeIdArr },
          clock_in_time: { gte: globalStart!, lte: globalEnd! },
          status: { in: ['completed', 'approved'] },
        },
        select: { employee_id: true, clock_in_time: true, total_minutes: true },
      }),
      this.prisma.hr_time_off_requests.findMany({
        where: {
          employee_id: { in: employeeIdArr },
          status: 'approved',
          start_date: { lte: globalEnd! },
          end_date: { gte: globalStart! },
        },
      }),
    ]);

    const results: PayslipCalcResult[] = [];
    for (const { employee, period } of workItems) {
      const empEntries = timeEntries.filter(
        (e) => e.employee_id === employee.id && e.clock_in_time >= period.start && e.clock_in_time <= period.end,
      );
      const totalMinutes = empEntries.reduce((sum, e) => sum + (this.toNumber(e.total_minutes) || 0), 0);
      const timesheetHours = totalMinutes / 60;
      if (employee.employment_type === 'casual' && timesheetHours <= 0) continue;

      const leaveForPeriod = approvedLeave.filter(
        (l) => l.employee_id === employee.id && new Date(l.end_date) >= period.start && new Date(l.start_date) <= period.end,
      );

      const data = await this.generatePayslipData(employee, period.start, period.end, period.paymentDate, {
        manualHours: timesheetHours > 0 ? timesheetHours : null,
        preFetchedLeave: leaveForPeriod as any,
      });
      data.employee_name = employee.profiles ? `${employee.profiles.first_name} ${employee.profiles.last_name}` : 'Unknown Employee';
      data.timesheet_hours = parseFloat(timesheetHours.toFixed(2));
      data.is_overdue = period.paymentDate < new Date();
      results.push(data);
    }

    results.sort((a, b) => new Date(a.pay_period_start).getTime() - new Date(b.pay_period_start).getTime());
    return {
      success: true,
      data: results,
      summary: {
        total_payslips: results.length,
        total_employees: duePeriods.length,
        overdue: results.filter((r) => r.is_overdue).length,
      },
    };
  }

  async previewBackfill(dto: Record<string, unknown>, user: UserLike) {
    this.ensureAdminOrManager(user);
    const employeeIds = Array.isArray(dto.employeeIds) ? (dto.employeeIds).map((v) => Number(v)) : [];
    if (employeeIds.length === 0) throw new BadRequestException('employeeIds array is required');

    const end = dto.endDate ? this.parseDate(dto.endDate) ?? new Date() : new Date();
    const start = this.parseDate(dto.startDate);
    const defaultHours = this.asNumber(dto.defaultHours);
    const paymentDelayDays = this.asNumber(dto.paymentDelayDays) ?? 2;

    const employees = await this.prisma.employees.findMany({
      where: { id: { in: employeeIds } },
      include: { profiles: { select: { first_name: true, last_name: true } } },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    const allLeave = await this.prisma.hr_time_off_requests.findMany({
      where: {
        employee_id: { in: employeeIds },
        status: 'approved',
        start_date: { lte: end },
        end_date: { gte: start ?? new Date(0) },
      },
    });
    const leaveByEmployee = this.groupBy(allLeave, 'employee_id');

    const missingMap = await this.findMissingPayPeriods(employeeIds, start, end);
    const results: PayslipCalcResult[] = [];
    for (const empId of employeeIds) {
      const employee = employeeMap.get(empId);
      if (!employee) continue;
      const missing = missingMap.get(empId) || [];
      const employeeLeave = (leaveByEmployee.get(empId) || []) as any[];
      for (const period of missing) {
        const payDate = new Date(period.end);
        payDate.setDate(payDate.getDate() + paymentDelayDays);
        const data = await this.generatePayslipData(employee, period.start, period.end, payDate, {
          manualHours: defaultHours,
          preFetchedLeave: employeeLeave,
        });
        data.employee_name = employee.profiles ? `${employee.profiles.first_name} ${employee.profiles.last_name}` : 'Unknown Employee';
        results.push(data);
      }
    }

    results.sort((a, b) => new Date(a.pay_period_start).getTime() - new Date(b.pay_period_start).getTime());
    return results;
  }

  async bulkCreate(dto: Record<string, unknown>, user: UserLike) {
    this.ensureAdminOrManager(user);
    const payslipInputs = Array.isArray(dto.payslips) ? (dto.payslips as Record<string, unknown>[]) : [];
    if (payslipInputs.length === 0) throw new BadRequestException('payslips array is required');

    const sorted = [...payslipInputs].sort((a, b) => new Date(String(a.payment_date)).getTime() - new Date(String(b.payment_date)).getTime());
    const employeeIds = [...new Set(sorted.map((p) => this.asNumber(p.employee_id)).filter((v) => v !== undefined))];
    const employees = await this.prisma.employees.findMany({
      where: { id: { in: employeeIds } },
      include: { profiles: { select: { first_name: true, last_name: true, email: true } } },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    const byDate = this.groupBy(sorted, (p: any) => new Date(String(p.payment_date)).toISOString().split('T')[0]);
    const uniqueDates = Array.from(byDate.keys()).sort();
    const runningYTD = new Map<number, { gross: number; tax: number; super: number }>();
    const created: any[] = [];

    for (const dateStr of uniqueDates) {
      const batch = byDate.get(dateStr) || [];
      const batchIds = [...new Set(batch.map((p: any) => Number(p.employee_id)))];
      for (const id of batchIds) if (!runningYTD.has(id)) runningYTD.set(id, { gross: 0, tax: 0, super: 0 });

      for (const data of batch) {
        const empId = Number(data.employee_id);
        const currentYTD = runningYTD.get(empId) ?? { gross: 0, tax: 0, super: 0 };
        const gross = this.toNumber(data.gross_pay);
        const tax = this.toNumber(data.tax_withheld);
        const superAmt = this.toNumber(data.superannuation);

        const dbData: any = { ...data };
        delete dbData.employee_name;
        dbData.ytd_gross = parseFloat((currentYTD.gross + gross).toFixed(2));
        dbData.ytd_tax = parseFloat((currentYTD.tax + tax).toFixed(2));
        dbData.ytd_super = parseFloat((currentYTD.super + superAmt).toFixed(2));
        dbData.status = 'generated';

        const payslip = await this.createPayslip(dbData);
        created.push(payslip);
        runningYTD.set(empId, { gross: currentYTD.gross + gross, tax: currentYTD.tax + tax, super: currentYTD.super + superAmt });
      }
    }

    const sendEmails = dto.sendEmails === true;
    if (sendEmails && created.length > 0) {
      for (const payslip of created) {
        const employee = employeeMap.get(payslip.employee_id);
        if (employee) this.emailPayslip(payslip, employee);
      }
    }

    await this.invalidateCache();
    return { success: true, message: `Successfully created ${created.length} payslips`, count: created.length };
  }

  async generatePdf(id: number, user: UserLike) {
    const payslip = await this.prisma.payslips.findUnique({
      where: { id },
      include: { employees: { include: { profiles: true } } },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    this.ensureAdminOrManagerOrOwner(user, payslip.employee_id);

    const employee: any = payslip.employees;
    employee.user = employee?.profiles || {};
    if (!employee.address || typeof employee.address !== 'object') {
      const parts = [employee.address, employee.city, employee.state, employee.postcode, employee.country].filter(Boolean);
      employee.address = parts.length > 0 ? { street: parts.join(', ') } : { street: 'N/A' };
    }

    const companyInfo = await this.prisma.company_info.findFirst({ where: { id: 1 } });
    const company = {
      name: companyInfo?.name || 'ClickBIT Pty Ltd',
      abn: companyInfo?.abn || '59 267 698 766',
      address: this.buildAddress(companyInfo),
    };

    const templateSettings = await this.pdfTemplatesService.getDefaultTemplateSettings('payslip');
    const buffer = await generatePayslipPDF(payslip, employee, company, templateSettings, null);
    return { buffer, filename: this.payslipNumber(payslip) };
  }

  private buildAddress(companyInfo: any): string {
    if (!companyInfo) return '19 Drysdale Approach, Baldivis, WA 6171';
    const parts = [companyInfo.address_line1, companyInfo.address_line2, companyInfo.city, companyInfo.state, companyInfo.postcode, companyInfo.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '19 Drysdale Approach, Baldivis, WA 6171';
  }

  async remove(id: number, dto: Record<string, unknown>) {
    if (dto.confirm !== 'DELETE') {
      return { success: false, message: 'Confirmation required. Send { confirm: "DELETE" } to proceed.' };
    }
    const payslip = await this.prisma.payslips.findUnique({ where: { id } });
    if (!payslip) throw new NotFoundException('Payslip not found');
    await this.prisma.payslips.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', undefined, id));
    return { success: true, message: `Payslip ${id} has been permanently deleted` };
  }

  async updateStatus(id: number, dto: Record<string, unknown>) {
    const status = this.asString(dto.status);
    const valid = ['draft', 'generated', 'pending', 'paid', 'sent'];
    if (!status || !valid.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${valid.join(', ')}`);
    }
    const payslip = await this.prisma.payslips.findUnique({ where: { id } });
    if (!payslip) throw new NotFoundException('Payslip not found');
    const mappedStatus = status === 'pending' ? 'generated' : status;
    const updated = await this.prisma.payslips.update({ where: { id }, data: { status: mappedStatus as any } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', undefined, id));
    return { success: true, message: 'Status updated', payslip: this.mapPayslip(updated) };
  }

  async resendEmail(id: number, user: UserLike) {
    this.ensureAdminOrManager(user);
    const payslip = await this.prisma.payslips.findUnique({
      where: { id },
      include: { employees: { include: { profiles: true } } },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    if (!payslip.employees?.profiles?.email) {
      return { success: false, message: 'Employee email not found' };
    }
    this.emailPayslip(payslip, payslip.employees);
    if ((payslip.status as any) === 'generated') {
      await this.prisma.payslips.update({ where: { id }, data: { status: 'sent' as any } });
      await this.invalidateCache();
      await this.cache?.del(this.cacheKey('detail', undefined, id));
    }
    return { success: true, message: 'Email sent successfully' };
  }

  // ---------------------------------------------------------------------------
  // Calculation helpers
  // ---------------------------------------------------------------------------

  private async generatePayslipData(
    employee: any,
    periodStart: Date,
    periodEnd: Date,
    paymentDate: Date,
    options: { manualHours?: number | null; preFetchedLeave?: any[] } = {},
  ): Promise<PayslipCalcResult> {
    const holidayInfo = await this.getPublicHolidayHours(employee, periodStart, periodEnd);

    let annualLeaveTaken = 0;
    let sickLeaveTaken = 0;
    if (options.preFetchedLeave && options.preFetchedLeave.length > 0) {
      for (const request of options.preFetchedLeave) {
        if (request.employee_id && request.employee_id !== employee.id) continue;
        const overlapDays = this.overlapDays(
          new Date(request.start_date),
          new Date(request.end_date),
          periodStart,
          periodEnd,
        );
        if (overlapDays <= 0) continue;
        const hours = this.leaveHoursForRequest(request, employee, overlapDays);
        const type = String(request.leave_type).toLowerCase();
        if (['annual', 'vacation', 'holiday'].includes(type)) annualLeaveTaken += hours;
        else if (['sick', 'personal', 'medical'].includes(type)) sickLeaveTaken += hours;
      }
    }

    const weekly = this.toNumber(employee.default_weekly_hours) || 38;
    let contractedHours = weekly;
    if (employee.pay_frequency === 'fortnightly') contractedHours = weekly * 2;
    else if (employee.pay_frequency === 'monthly') contractedHours = weekly * 4.3333;

    let standardHours = contractedHours;
    if (options.manualHours !== undefined && options.manualHours !== null) {
      standardHours = Math.min(options.manualHours, contractedHours);
    }

    const workHours = Math.max(0, standardHours - (annualLeaveTaken + sickLeaveTaken + holidayInfo.hours));

    const hourlyRate = this.toNumber(employee.hourly_rate);
    const annualSalary = this.toNumber(employee.salary);
    let grossPay = 0;
    const lineItems: PayslipLineItem[] = [];

    if (annualSalary > 0) {
      let periodFactor = 52;
      if (employee.pay_frequency === 'fortnightly') periodFactor = 26;
      if (employee.pay_frequency === 'monthly') periodFactor = 12;
      const periodSalary = annualSalary / periodFactor;
      const derivedRate = contractedHours > 0 ? periodSalary / contractedHours : 0;

      const workPay = workHours * derivedRate;
      lineItems.push({ description: 'Base Salary', quantity: parseFloat(workHours.toFixed(2)), rate: parseFloat(derivedRate.toFixed(2)), amount: workPay.toFixed(2), type: 'earning' });
      let componentsTotal = workPay;
      if (annualLeaveTaken > 0) {
        const amt = annualLeaveTaken * derivedRate;
        lineItems.push({ description: 'Annual Leave', quantity: annualLeaveTaken, rate: derivedRate, amount: amt.toFixed(2), type: 'earning' });
        componentsTotal += amt;
      }
      if (sickLeaveTaken > 0) {
        const amt = sickLeaveTaken * derivedRate;
        lineItems.push({ description: 'Personal/Sick Leave', quantity: sickLeaveTaken, rate: derivedRate, amount: amt.toFixed(2), type: 'earning' });
        componentsTotal += amt;
      }
      if (holidayInfo.hours > 0) {
        const amt = holidayInfo.hours * derivedRate;
        lineItems.push({ description: `Public Holiday (${holidayInfo.holidays.join(', ')})`, quantity: parseFloat(holidayInfo.hours.toFixed(2)), rate: parseFloat(derivedRate.toFixed(2)), amount: amt.toFixed(2), type: 'earning' });
        componentsTotal += amt;
      }
      grossPay = componentsTotal;
    } else {
      const basePay = workHours * hourlyRate;
      lineItems.push({ description: 'Base Pay', quantity: parseFloat(workHours.toFixed(2)), rate: hourlyRate, amount: basePay.toFixed(2), type: 'earning' });
      if (annualLeaveTaken > 0) lineItems.push({ description: 'Annual Leave', quantity: annualLeaveTaken, rate: hourlyRate, amount: (annualLeaveTaken * hourlyRate).toFixed(2), type: 'earning' });
      if (sickLeaveTaken > 0) lineItems.push({ description: 'Personal/Sick Leave', quantity: sickLeaveTaken, rate: hourlyRate, amount: (sickLeaveTaken * hourlyRate).toFixed(2), type: 'earning' });
      if (holidayInfo.hours > 0) lineItems.push({ description: `Public Holiday (${holidayInfo.holidays.join(', ')})`, quantity: parseFloat(holidayInfo.hours.toFixed(2)), rate: hourlyRate, amount: (holidayInfo.hours * hourlyRate).toFixed(2), type: 'earning' });
      grossPay = standardHours * hourlyRate;
    }

    const currency = (employee.currency || 'AUD').toUpperCase();
    let tax = 0;
    let superAmount = 0;
    if (currency === 'AUD') {
      tax = this.calculateTax(grossPay, employee.pay_frequency, employee.tax_free_threshold_claimed, paymentDate);
      superAmount = this.calculateSuper(grossPay, paymentDate);
    }

    const accruals = this.calculateLeaveAccrual(employee, standardHours);
    const openingAnnual = this.toNumber(employee.annual_leave_balance);
    let openingSick = this.toNumber(employee.sick_leave_balance);
    const isResetPeriod = currency === 'BDT'
      ? await this.isFirstPayslipOfContractYear(employee.id, employee.hire_date, paymentDate)
      : await this.isFirstPayslipOfFY(employee.id, paymentDate);
    if (isResetPeriod) openingSick = this.getSickLeaveEntitlement(employee);

    const closingAnnual = openingAnnual + accruals.annual - annualLeaveTaken;
    const closingSick = openingSick + accruals.sick - sickLeaveTaken;
    const leaveData = {
      annual_opening: parseFloat(openingAnnual.toFixed(2)),
      sick_opening: parseFloat(openingSick.toFixed(2)),
      annual_accrued: parseFloat(accruals.annual.toFixed(4)),
      sick_accrued: parseFloat(accruals.sick.toFixed(4)),
      annual_taken: annualLeaveTaken,
      sick_taken: sickLeaveTaken,
      annual_balance: parseFloat(closingAnnual.toFixed(2)),
      sick_balance: parseFloat(closingSick.toFixed(2)),
      sick_fy_reset: isResetPeriod,
    };

    const ytd = await this.calculateYTD(employee.id, paymentDate);

    return {
      employee_id: employee.id,
      pay_period_start: periodStart,
      pay_period_end: periodEnd,
      payment_date: paymentDate,
      pay_frequency: employee.pay_frequency || 'fortnightly',
      currency,
      gross_pay: parseFloat(grossPay.toFixed(2)),
      tax_withheld: parseFloat(tax.toFixed(2)),
      superannuation: parseFloat(superAmount.toFixed(2)),
      net_pay: parseFloat((grossPay - tax).toFixed(2)),
      ytd_gross: parseFloat((ytd.gross + grossPay).toFixed(2)),
      ytd_tax: parseFloat((ytd.tax + tax).toFixed(2)),
      ytd_super: parseFloat((ytd.super + superAmount).toFixed(2)),
      line_items: lineItems,
      leave_data: leaveData,
      status: 'generated',
    };
  }

  private async getTimesheetHours(employeeId: number, periodStart: Date, periodEnd: Date) {
    const result = await this.prisma.hr_time_entries.aggregate({
      _sum: { total_minutes: true },
      where: {
        employee_id: employeeId,
        clock_in_time: { gte: periodStart, lte: periodEnd },
        status: { in: ['completed', 'approved'] },
      },
    });
    return (this.toNumber(result._sum.total_minutes) || 0) / 60;
  }

  private async getPublicHolidayHours(employee: any, periodStart: Date, periodEnd: Date) {
    if (employee.employment_type === 'casual') return { hours: 0, holidays: [] };
    const location = (employee.location || 'Australia').trim();
    const currency = (employee.currency || 'AUD').toUpperCase();
    const workDaysPerWeek = currency === 'BDT' ? 6 : 5;
    const weeklyHours = this.toNumber(employee.default_weekly_hours) || 38;
    const dailyHours = weeklyHours / workDaysPerWeek;

    const start = new Date(periodStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(periodEnd);
    end.setHours(23, 59, 59, 999);

    const holidays = await this.prisma.hr_public_holidays.findMany({
      where: { holiday_date: { gte: start, lte: end }, location: { contains: location, mode: 'insensitive' } },
    });

    let totalHours = 0;
    const matched: string[] = [];
    for (const h of holidays) {
      const d = new Date(h.holiday_date);
      const day = d.getDay();
      const isWorkday = currency === 'BDT'
        ? (day >= 0 && day <= 5 && day !== 5)
        : (day >= 1 && day <= 5);
      if (isWorkday) {
        totalHours += dailyHours;
        matched.push(h.name);
      }
    }
    return { hours: totalHours, holidays: matched };
  }

  private async getNextPayPeriods() {
    const employees = await this.prisma.employees.findMany({
      where: { employment_status: 'active' },
      include: { profiles: { select: { first_name: true, last_name: true, email: true, avatar: true } } },
    });
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const employeeIds = employees.map((e) => e.id);
    const latestByEmployee = employeeIds.length
      ? await this.prisma.payslips.groupBy({
          by: ['employee_id'],
          where: { employee_id: { in: employeeIds } },
          _max: { pay_period_end: true },
        })
      : [];
    const lastPayslipMap = new Map<number, Date | null>();
    for (const row of latestByEmployee) lastPayslipMap.set(row.employee_id, row._max.pay_period_end ? new Date(row._max.pay_period_end) : null);

    const results: { employee: any; periods: { start: Date; end: Date; paymentDate: Date }[] }[] = [];

    for (const emp of employees) {
      const frequency = emp.pay_frequency || 'fortnightly';
      const lastEnd = lastPayslipMap.get(emp.id);

      let nextStart: Date;
      if (lastEnd) {
        nextStart = new Date(lastEnd);
        nextStart.setDate(nextStart.getDate() + 1);
      } else {
        nextStart = emp.hire_date ? new Date(emp.hire_date) : new Date();
        if (!emp.hire_date) nextStart.setMonth(nextStart.getMonth() - 1);
      }
      nextStart.setHours(0, 0, 0, 0);

      const duePeriods: { start: Date; end: Date; paymentDate: Date }[] = [];
      let currentStart = new Date(nextStart);
      while (currentStart < today) {
        const currentEnd = new Date(currentStart);
        if (frequency === 'weekly') currentEnd.setDate(currentEnd.getDate() + 6);
        else if (frequency === 'fortnightly') currentEnd.setDate(currentEnd.getDate() + 13);
        else if (frequency === 'monthly') {
          const targetMonth = currentStart.getMonth() + 1;
          currentEnd.setFullYear(currentStart.getFullYear(), targetMonth, currentStart.getDate());
          if (currentEnd.getMonth() !== targetMonth % 12) currentEnd.setDate(0);
          currentEnd.setDate(currentEnd.getDate() - 1);
        }

        if (currentEnd <= today) {
          const paymentDate = new Date(currentEnd);
          paymentDate.setDate(paymentDate.getDate() + 2);
          duePeriods.push({ start: new Date(currentStart), end: new Date(currentEnd), paymentDate });
        } else break;

        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() + 1);
      }
      if (duePeriods.length > 0) results.push({ employee: emp, periods: duePeriods });
    }
    return results;
  }

  private async findMissingPayPeriods(employeeIdOrIds: number | number[], startDate?: Date | null, endDate?: Date) {
    const ids = Array.isArray(employeeIdOrIds) ? employeeIdOrIds : [employeeIdOrIds];
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(0, 0, 0, 0);
    const globalStart = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    globalStart.setHours(0, 0, 0, 0);

    const employees = await this.prisma.employees.findMany({ where: { id: { in: ids } } });
    const existing = await this.prisma.payslips.findMany({
      where: { employee_id: { in: ids }, pay_period_start: { gte: globalStart, lt: end } },
      select: { employee_id: true, pay_period_start: true },
    });

    const existingSet = new Map<number, Set<number>>();
    for (const p of existing) {
      if (!existingSet.has(p.employee_id)) existingSet.set(p.employee_id, new Set());
      const d = new Date(p.pay_period_start);
      d.setHours(0, 0, 0, 0);
      existingSet.get(p.employee_id)!.add(d.getTime());
    }

    const results = new Map<number, { start: Date; end: Date; frequency: string }[]>();
    for (const employee of employees) {
      const frequency = employee.pay_frequency || 'fortnightly';
      let start = startDate ? new Date(startDate) : new Date(employee.hire_date || globalStart);
      if (start < globalStart) start = new Date(globalStart);
      start.setHours(0, 0, 0, 0);

      const missing: { start: Date; end: Date; frequency: string }[] = [];
      const empExisting = existingSet.get(employee.id) || new Set();
      let current = new Date(start);
      while (current < end) {
        const currentEnd = new Date(current);
        if (frequency === 'weekly') currentEnd.setDate(currentEnd.getDate() + 6);
        else if (frequency === 'fortnightly') currentEnd.setDate(currentEnd.getDate() + 13);
        else if (frequency === 'monthly') {
          const targetMonth = current.getMonth() + 1;
          currentEnd.setFullYear(current.getFullYear(), targetMonth, current.getDate());
          if (currentEnd.getMonth() !== targetMonth % 12) currentEnd.setDate(0);
          currentEnd.setDate(currentEnd.getDate() - 1);
        }
        if (current >= end) break;
        if (!empExisting.has(current.getTime())) missing.push({ start: new Date(current), end: new Date(currentEnd), frequency });
        current = new Date(currentEnd);
        current.setDate(current.getDate() + 1);
      }
      results.set(employee.id, missing);
    }
    return results;
  }

  private async calculateYTD(employeeId: number, dateRef: Date) {
    const fyStart = this.getFinancialYearStart(dateRef);
    const result = await this.prisma.payslips.aggregate({
      _sum: { gross_pay: true, tax_withheld: true, superannuation: true },
      where: {
        employee_id: employeeId,
        payment_date: { gte: fyStart, lt: dateRef },
        status: { not: 'draft' as any },
      },
    });
    return {
      gross: this.toNumber(result._sum.gross_pay),
      tax: this.toNumber(result._sum.tax_withheld),
      super: this.toNumber(result._sum.superannuation),
    };
  }

  private async getBulkYTD(employeeIds: number[], dateRef: Date) {
    const fyStart = this.getFinancialYearStart(dateRef);
    const result = await this.prisma.payslips.groupBy({
      by: ['employee_id'],
      _sum: { gross_pay: true, tax_withheld: true, superannuation: true },
      where: {
        employee_id: { in: employeeIds },
        payment_date: { gte: fyStart, lt: dateRef },
        status: { not: 'draft' as any },
      },
    });
    const map = new Map<number, { gross: number; tax: number; super: number }>();
    for (const id of employeeIds) map.set(id, { gross: 0, tax: 0, super: 0 });
    for (const row of result) {
      map.set(row.employee_id, {
        gross: this.toNumber(row._sum.gross_pay),
        tax: this.toNumber(row._sum.tax_withheld),
        super: this.toNumber(row._sum.superannuation),
      });
    }
    return map;
  }

  private async createPayslip(data: any) {
    return this.prisma.$transaction(async (tx) => {
      const payslip = await tx.payslips.create({ data: data });
      if (data.leave_data && data.employee_id) {
        const employee = await tx.employees.findUnique({ where: { id: data.employee_id } });
        if (employee) {
          const annualChange = (data.leave_data.annual_accrued || 0) - (data.leave_data.annual_taken || 0);
          const newAnnual = this.toNumber(employee.annual_leave_balance) + annualChange;
          const newSick = data.leave_data.sick_fy_reset
            ? data.leave_data.sick_balance
            : this.toNumber(employee.sick_leave_balance) - (data.leave_data.sick_taken || 0);
          await tx.employees.update({
            where: { id: employee.id },
            data: { annual_leave_balance: newAnnual, sick_leave_balance: newSick },
          });
        }
      }
      return payslip;
    });
  }

  private emailPayslip(payslip: any, employee: any) {
    const email = employee?.profiles?.email;
    if (!email) return false;
    // Email sending and real PDF generation are stubbed.
    console.log(`[PAYSLIP EMAIL STUB] Would send payslip ${payslip.id} to ${email}`);
    return true;
  }

  private calculateTax(grossAmount: number, frequency: string, taxFreeThresholdClaimed: boolean, _paymentDate: Date) {
    let weeklyEarnings = grossAmount;
    if (frequency === 'fortnightly') weeklyEarnings = grossAmount / 2;
    else if (frequency === 'monthly') weeklyEarnings = (grossAmount * 12) / 52;
    weeklyEarnings = Math.floor(weeklyEarnings);

    // Use post-July 2024 Stage 3 Scale 2 (TFT claimed) for all payments.
    const scale = taxFreeThresholdClaimed ? SCALE_2_WEEKLY : SCALE_2_WEEKLY;
    let taxWeekly = 0;
    for (const bracket of scale) {
      if (weeklyEarnings < bracket.limit) {
        taxWeekly = weeklyEarnings * bracket.a - bracket.b;
        break;
      }
    }
    taxWeekly = Math.round(Math.max(0, taxWeekly));
    if (frequency === 'fortnightly') return taxWeekly * 2;
    if (frequency === 'monthly') return Math.round((taxWeekly * 52) / 12);
    return taxWeekly;
  }

  private calculateSuper(grossAmount: number, paymentDate: Date) {
    const d = new Date(paymentDate);
    const startFY26 = new Date('2025-07-01');
    const rate = d >= startFY26 ? 12.0 : 11.5;
    return Math.round((grossAmount * (rate / 100)) * 100) / 100;
  }

  private calculateLeaveAccrual(employee: any, periodHours: number) {
    const currency = (employee.currency || 'AUD').toUpperCase();
    const weeklyHours = this.toNumber(employee.default_weekly_hours) || 38;
    let annualLeaveHrsPerYear: number;
    let weeklyWorkHours: number;
    if (currency === 'BDT') {
      annualLeaveHrsPerYear = 80;
      weeklyWorkHours = 48;
    } else {
      annualLeaveHrsPerYear = 4 * weeklyHours;
      weeklyWorkHours = weeklyHours;
    }
    const annualRatePerHour = annualLeaveHrsPerYear / (52 * weeklyWorkHours);
    return { annual: periodHours * annualRatePerHour, sick: 0 };
  }

  private getSickLeaveEntitlement(employee: any) {
    if (employee.employment_type === 'casual' || employee.employment_type === 'contractor') return 0;
    const currency = (employee.currency || 'AUD').toUpperCase();
    const location = (employee.location || 'Australia').toLowerCase();
    if (currency !== 'AUD' && !location.includes('australia')) return 0;
    const weeklyHours = this.toNumber(employee.default_weekly_hours) || 38;
    if (employee.employment_type === 'full_time') return SICK_LEAVE_ENTITLEMENT_HOURS;
    return (weeklyHours / 38) * SICK_LEAVE_ENTITLEMENT_HOURS;
  }

  private async isFirstPayslipOfFY(employeeId: number, paymentDate: Date) {
    const fyStart = this.getFinancialYearStart(paymentDate);
    const count = await this.prisma.payslips.count({
      where: { employee_id: employeeId, payment_date: { gte: fyStart, lt: paymentDate }, status: { not: 'draft' as any } },
    });
    return count === 0;
  }

  private async isFirstPayslipOfContractYear(employeeId: number, hireDate: Date | null, paymentDate: Date) {
    if (!hireDate) return false;
    const hire = new Date(hireDate);
    const pay = new Date(paymentDate);
    const years = pay.getFullYear() - hire.getFullYear();
    const anniversary = new Date(hire);
    anniversary.setFullYear(hire.getFullYear() + years);
    if (anniversary > pay) anniversary.setFullYear(anniversary.getFullYear() - 1);
    const count = await this.prisma.payslips.count({
      where: { employee_id: employeeId, payment_date: { gte: anniversary, lt: paymentDate } },
    });
    return count === 0;
  }

  private getFinancialYearStart(date: Date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const startYear = month >= 6 ? year : year - 1;
    return new Date(startYear, 6, 1);
  }

  private overlapDays(reqStart: Date, reqEnd: Date, periodStart: Date, periodEnd: Date) {
    const start = reqStart > periodStart ? reqStart : periodStart;
    const end = reqEnd < periodEnd ? reqEnd : periodEnd;
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  private leaveHoursForRequest(request: any, employee: any, overlapDays: number) {
    const currency = (employee.currency || 'AUD').toUpperCase();
    const workDaysPerWeek = currency === 'BDT' ? 6 : 5;
    const dailyHours = (this.toNumber(employee.default_weekly_hours) || 38) / workDaysPerWeek;

    if (request.total_hours && request.total_days) {
      const totalDays = this.toNumber(request.total_days) || 1;
      return (this.toNumber(request.total_hours) / totalDays) * Math.min(overlapDays, totalDays);
    } else if (request.total_hours) {
      const reqStart = new Date(request.start_date);
      const reqEnd = new Date(request.end_date);
      const reqTotalDays = Math.floor((reqEnd.getTime() - reqStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return (this.toNumber(request.total_hours) / reqTotalDays) * overlapDays;
    }
    return overlapDays * dailyHours;
  }

  private groupBy<T>(arr: T[], key: keyof T | ((item: T) => string | number)) {
    const map = new Map<string | number, T[]>();
    for (const item of arr) {
      const k = typeof key === 'function' ? key(item) : (item[key] as any);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(item);
    }
    return map;
  }

  private mapPayslip(p: any) {
    const profile = p.employees?.profiles;
    return {
      ...p,
      employee: p.employees
        ? {
            ...p.employees,
            name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.email || `Employee ${p.employees.id}`,
            email: profile?.email,
          }
        : undefined,
    };
  }

  private async getEmployeeWithProfile(id: number) {
    return this.prisma.employees.findUnique({
      where: { id },
      include: { profiles: { select: { first_name: true, last_name: true, email: true } } },
    });
  }

  private ensureAdminOrManager(user: UserLike) {
    if (!['admin', 'manager'].includes(user.role.toLowerCase())) throw new ForbiddenException('Not authorized');
  }

  private ensureAdminOrManagerOrSelf(user: UserLike, userId: number) {
    if (user.id === userId || ['admin', 'manager'].includes(user.role.toLowerCase())) return;
    throw new ForbiddenException('Not authorized');
  }

  private ensureAdminOrManagerOrOwner(user: UserLike, ownerEmployeeId: number) {
    if (['admin', 'manager'].includes(user.role.toLowerCase())) return;
    this.prisma.employees.findFirst({ where: { id: ownerEmployeeId, user_id: user.id } }).then((emp) => {
      if (!emp) throw new ForbiddenException('Not authorized');
    });
  }

  private payslipNumber(payslip: any) {
    const d = new Date(payslip.payment_date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `PS-${y}-${m}${day}-${String(payslip.id).padStart(3, '0')}.pdf`;
  }

  private parseDate(value: unknown): Date | null {
    const str = this.asString(value);
    if (!str) return null;
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private asString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value;
    return undefined;
  }

  private asNumber(value: unknown): number | undefined {
    const str = this.asString(value);
    if (str !== undefined) {
      const n = Number(str);
      return Number.isNaN(n) ? undefined : n;
    }
    if (typeof value === 'number') return value;
    return undefined;
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (value instanceof Decimal) return value.toNumber();
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }
}
