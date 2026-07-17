import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

interface UserLike {
  id: number;
  role: string;
}

const contractInclude = {
  employees_hr_contracts_employee_idToemployees: {
    include: {
      profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
    },
  },
  employees_hr_contracts_manager_idToemployees: {
    include: {
      profiles: { select: { id: true, first_name: true, last_name: true } },
    },
  },
  profiles: { select: { id: true, first_name: true, last_name: true } },
};

function normalizeContract(c: any) {
  const emp = c.employees_hr_contracts_employee_idToemployees;
  const mgr = c.employees_hr_contracts_manager_idToemployees;
  const empProfile = emp?.profiles;
  const mgrProfile = mgr?.profiles;
  return {
    ...c,
    employee: emp
      ? {
          ...emp,
          name: empProfile ? `${empProfile.first_name || ''} ${empProfile.last_name || ''}`.trim() : `Employee ${emp.id}`,
          email: empProfile?.email,
        }
      : undefined,
    manager: mgr
      ? {
          ...mgr,
          name: mgrProfile ? `${mgrProfile.first_name || ''} ${mgrProfile.last_name || ''}`.trim() : `Manager ${mgr.id}`,
          email: mgrProfile?.email,
        }
      : undefined,
    creator: c.profiles
      ? { ...c.profiles, name: `${c.profiles.first_name || ''} ${c.profiles.last_name || ''}`.trim() }
      : undefined,
  };
}

@Injectable()
export class HrContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: UserLike, query: Record<string, unknown>) {
    const selfMode = String(query.self).toLowerCase() === 'true';
    const where: Prisma.hr_contractsWhereInput = {};
    if (typeof query.status === 'string') where.status = query.status as any;

    const isPrivileged = ['admin', 'manager'].includes(user.role.toLowerCase());
    if (!isPrivileged || selfMode) {
      const self = await this.prisma.employees.findUnique({ where: { user_id: user.id } });
      if (!self) return { success: true, data: [] };
      where.employee_id = self.id;
    } else if (query.employee_id) {
      const id = Number(query.employee_id);
      if (!Number.isNaN(id)) where.employee_id = id;
    }

    const contracts = await this.prisma.hr_contracts.findMany({
      where,
      include: contractInclude,
      orderBy: [{ start_date: 'desc' }, { created_at: 'desc' }],
    });

    return { success: true, data: contracts.map(normalizeContract) };
  }

  async findOne(user: UserLike, id: number) {
    const contract = await this.prisma.hr_contracts.findUnique({ where: { id }, include: contractInclude });
    if (!contract) throw new NotFoundException('Contract not found');

    const isPrivileged = ['admin', 'manager'].includes(user.role.toLowerCase());
    if (!isPrivileged) {
      const self = await this.prisma.employees.findUnique({ where: { user_id: user.id } });
      if (!self || self.id !== contract.employee_id) {
        throw new ForbiddenException('Not authorized to view this contract');
      }
    }

    return { success: true, data: normalizeContract(contract) };
  }

  async findBlockedEmployeeIds(user: UserLike) {
    if (user.role.toLowerCase() === 'admin') return { blockedEmployeeIds: [] };

    const managerEmp = await this.prisma.employees.findUnique({ where: { user_id: user.id } });
    if (!managerEmp) return { blockedEmployeeIds: [] };

    const blockedIds = new Set<number>();
    blockedIds.add(managerEmp.id);

    let currentId = managerEmp.manager_id;
    let depth = 0;
    while (currentId && depth < 10) {
      blockedIds.add(currentId);
      const upper = await this.prisma.employees.findUnique({
        where: { id: currentId },
        select: { id: true, manager_id: true },
      });
      if (!upper) break;
      currentId = upper.manager_id;
      depth++;
    }

    const adminEmployees = await this.prisma.employees.findMany({
      select: { id: true },
      where: { profiles: { role: 'admin' } },
    });
    adminEmployees.forEach((e) => blockedIds.add(e.id));

    return { blockedEmployeeIds: Array.from(blockedIds) };
  }

  async create(user: UserLike, dto: CreateContractDtoLike) {
    const coi = await this.checkCOI(user, Number(dto.employee_id));
    if (coi) throw new ForbiddenException(coi.message);

    await this.prisma.hr_contracts.updateMany({
      where: {
        employee_id: Number(dto.employee_id),
        status: 'active',
      },
      data: { status: 'superseded' as any },
    });

    const contract = await this.prisma.hr_contracts.create({
      data: this.buildContractData(user.id, dto, 'active'),
      include: contractInclude,
    });

    await this.syncToEmployee(contract.employee_id);

    return { success: true, data: normalizeContract(contract) };
  }

  async update(user: UserLike, id: number, dto: UpdateContractDtoLike) {
    const existing = await this.prisma.hr_contracts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contract not found');

    const coi = await this.checkCOI(user, existing.employee_id);
    if (coi) throw new ForbiddenException(coi.message);

    const data = this.buildUpdateData(dto);
    const contract = await this.prisma.hr_contracts.update({
      where: { id },
      data,
      include: contractInclude,
    });

    if (contract.status === 'active') {
      await this.syncToEmployee(contract.employee_id);
    }

    return { success: true, data: normalizeContract(contract) };
  }

  async accept(user: UserLike, id: number) {
    const contract = await this.prisma.hr_contracts.findUnique({
      where: { id },
      include: contractInclude,
    });
    if (!contract) throw new NotFoundException('Contract not found');

    const self = await this.prisma.employees.findUnique({ where: { user_id: user.id } });
    if (!self || self.id !== contract.employee_id) {
      throw new ForbiddenException('You may only accept your own contract');
    }

    if (contract.employee_accepted_at) {
      throw new BadRequestException('Contract already accepted');
    }

    const profile = await this.prisma.profiles.findUnique({
      where: { id: user.id },
      select: { first_name: true, last_name: true },
    });
    const employeeName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();

    const updated = await this.prisma.hr_contracts.update({
      where: { id },
      data: {
        employee_accepted_at: new Date(),
        employee_signature_name: employeeName,
        employee_accepted_ip: 'unknown',
      },
      include: contractInclude,
    });

    return {
      success: true,
      message: 'Contract accepted successfully',
      accepted_at: updated.employee_accepted_at,
      signature_name: employeeName,
    };
  }

  async activate(user: UserLike, id: number) {
    const contract = await this.prisma.hr_contracts.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException('Contract not found');

    const coi = await this.checkCOI(user, contract.employee_id);
    if (coi) throw new ForbiddenException(coi.message);

    await this.supersedeActiveContracts(contract.employee_id, id);

    const updated = await this.prisma.hr_contracts.update({
      where: { id },
      data: { status: 'active' as any },
      include: contractInclude,
    });

    await this.syncToEmployee(updated.employee_id);

    return { success: true, message: 'Contract activated', data: normalizeContract(updated) };
  }

  async terminate(user: UserLike, id: number, reason?: string) {
    const contract = await this.prisma.hr_contracts.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException('Contract not found');

    const coi = await this.checkCOI(user, contract.employee_id);
    if (coi) throw new ForbiddenException(coi.message);

    const today = new Date().toISOString().split('T')[0];
    const updated = await this.prisma.hr_contracts.update({
      where: { id },
      data: {
        status: 'terminated' as any,
        end_date: new Date(today),
        notes: contract.notes ? `${contract.notes}\nTerminated: ${reason || ''}` : `Terminated: ${reason || ''}`,
      },
      include: contractInclude,
    });

    return { success: true, message: 'Contract terminated', data: normalizeContract(updated) };
  }

  async downloadPdf(user: UserLike, id: number) {
    const contract = await this.prisma.hr_contracts.findUnique({
      where: { id },
      include: contractInclude,
    });
    if (!contract) throw new NotFoundException('Contract not found');

    if (!['admin', 'manager'].includes(user.role.toLowerCase())) {
      const self = await this.prisma.employees.findUnique({ where: { user_id: user.id } });
      if (!self || self.id !== contract.employee_id) {
        throw new ForbiddenException('Not authorized to download this contract');
      }
    }

    const employee = contract.employees_hr_contracts_employee_idToemployees?.profiles;
    const manager = contract.employees_hr_contracts_manager_idToemployees?.profiles;
    const filename = `contract-${contract.contract_number || id}.pdf`;
    const buffer = await this.generateContractPdf(contract, employee, manager);
    return { buffer, filename };
  }

  private generateContractPdf(contract: any, employee: any, manager: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Employment Contract', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Contract Number: ${contract.contract_number || contract.id}`);
      doc.text(`Employee: ${employee?.first_name || ''} ${employee?.last_name || ''}`);
      if (contract.position) doc.text(`Position: ${contract.position}`);
      if (contract.department) doc.text(`Department: ${contract.department}`);
      if (contract.employment_type) doc.text(`Employment Type: ${contract.employment_type}`);
      if (contract.start_date) {
        doc.text(`Start Date: ${new Date(contract.start_date).toISOString().split('T')[0]}`);
      }
      if (contract.end_date) {
        doc.text(`End Date: ${new Date(contract.end_date).toISOString().split('T')[0]}`);
      }
      if (contract.pay_frequency) doc.text(`Pay Frequency: ${contract.pay_frequency}`);
      if (contract.salary) doc.text(`Salary: $${Number(contract.salary).toLocaleString('en-AU')}`);
      if (contract.hourly_rate) doc.text(`Hourly Rate: $${Number(contract.hourly_rate)}`);
      if (manager) doc.text(`Manager: ${manager.first_name || ''} ${manager.last_name || ''}`);
      doc.moveDown();
      doc.fontSize(14).text('Terms');
      doc.fontSize(11).text(contract.terms_summary || 'No terms provided.');
      doc.moveDown();
      if (contract.notes) {
        doc.fontSize(14).text('Notes');
        doc.fontSize(11).text(contract.notes);
      }
      doc.end();
    });
  }

  private async checkCOI(user: UserLike, targetEmployeeId: number): Promise<{ message: string } | null> {
    if (user.role.toLowerCase() === 'admin') return null;

    const managerEmp = await this.prisma.employees.findUnique({ where: { user_id: user.id } });
    if (!managerEmp) return null;

    if (managerEmp.id === targetEmployeeId) {
      return { message: 'You cannot modify your own employment contract.' };
    }

    const targetEmp = await this.prisma.employees.findUnique({
      where: { id: targetEmployeeId },
      include: { profiles: { select: { role: true } } },
    });
    if (targetEmp?.profiles?.role === 'admin') {
      return { message: 'You cannot modify the contract of an administrator.' };
    }

    let currentId = managerEmp.manager_id;
    let depth = 0;
    while (currentId && depth < 10) {
      if (currentId === targetEmployeeId) {
        return { message: 'You cannot modify the contract of your manager or supervisor.' };
      }
      const upper = await this.prisma.employees.findUnique({
        where: { id: currentId },
        select: { id: true, manager_id: true },
      });
      if (!upper) break;
      currentId = upper.manager_id;
      depth++;
    }

    return null;
  }

  private async supersedeActiveContracts(employeeId: number, excludeId: number) {
    await this.prisma.hr_contracts.updateMany({
      where: { employee_id: employeeId, status: 'active' as any, id: { not: excludeId } },
      data: { status: 'superseded' as any },
    });
  }

  private async syncToEmployee(employeeId: number) {
    const contract = await this.prisma.hr_contracts.findFirst({
      where: { employee_id: employeeId, status: 'active' as any },
      orderBy: { start_date: 'desc' },
    });
    if (!contract) return;

    const data: Prisma.employeesUncheckedUpdateInput = {};
    if (contract.employment_type !== null && contract.employment_type !== undefined) data.employment_type = contract.employment_type;
    if (contract.position !== undefined) data.position = contract.position;
    if (contract.department !== undefined) data.department = contract.department;
    if (contract.manager_id !== undefined) data.manager_id = contract.manager_id;
    if (contract.hourly_rate !== undefined) data.hourly_rate = contract.hourly_rate;
    if (contract.salary !== undefined) data.salary = contract.salary;
    if (contract.pay_frequency !== undefined) data.pay_frequency = contract.pay_frequency;
    if (contract.currency !== undefined) data.currency = contract.currency;
    if (contract.default_weekly_hours !== undefined) data.default_weekly_hours = contract.default_weekly_hours;
    if (contract.work_schedule) data.work_schedule = contract.work_schedule;
    if (contract.work_address !== undefined) data.address = contract.work_address;
    if (contract.work_city !== undefined) data.city = contract.work_city;
    if (contract.work_state !== undefined) data.state = contract.work_state;
    if (contract.work_country !== undefined) data.country = contract.work_country;
    if (contract.work_postcode !== undefined) data.postcode = contract.work_postcode;
    if (contract.work_timezone !== undefined) data.timezone = contract.work_timezone;

    await this.prisma.employees.update({ where: { id: employeeId }, data });
  }

  private buildContractData(userId: number, dto: CreateContractDtoLike, status: string): Prisma.hr_contractsUncheckedCreateInput {
    const contractNumber = `CTR-${Date.now()}`;
    return {
      contract_number: contractNumber,
      employee_id: Number(dto.employee_id),
      start_date: new Date(dto.start_date),
      end_date: dto.end_date ? new Date(dto.end_date) : undefined,
      employment_type: dto.employment_type as any,
      position: dto.position,
      department: dto.department,
      manager_id: dto.manager_id ? Number(dto.manager_id) : undefined,
      hourly_rate: dto.hourly_rate ? new Decimal(dto.hourly_rate) : undefined,
      salary: dto.salary ? new Decimal(dto.salary) : undefined,
      pay_frequency: dto.pay_frequency as any,
      currency: dto.currency,
      default_weekly_hours: dto.default_weekly_hours ? new Decimal(dto.default_weekly_hours) : undefined,
      work_schedule: dto.work_schedule as any,
      renewal_date: dto.renewal_date ? new Date(dto.renewal_date) : undefined,
      terms_summary: dto.terms_summary,
      change_reason: dto.change_reason,
      notes: dto.notes,
      responsibilities: dto.responsibilities,
      work_address: dto.work_address,
      work_city: dto.work_city,
      work_state: dto.work_state,
      work_country: dto.work_country,
      work_postcode: dto.work_postcode,
      work_timezone: dto.work_timezone,
      status: status as any,
      created_by: userId || undefined,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  private buildUpdateData(dto: UpdateContractDtoLike): Prisma.hr_contractsUncheckedUpdateInput {
    const data: Prisma.hr_contractsUncheckedUpdateInput = {};
    if (dto.start_date !== undefined) data.start_date = new Date(dto.start_date);
    if (dto.end_date !== undefined) data.end_date = dto.end_date ? new Date(dto.end_date) : null;
    if (dto.employment_type !== undefined) data.employment_type = dto.employment_type as any;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.manager_id !== undefined) data.manager_id = dto.manager_id ? Number(dto.manager_id) : null;
    if (dto.hourly_rate !== undefined) data.hourly_rate = dto.hourly_rate ? new Decimal(dto.hourly_rate) : null;
    if (dto.salary !== undefined) data.salary = dto.salary ? new Decimal(dto.salary) : null;
    if (dto.pay_frequency !== undefined) data.pay_frequency = dto.pay_frequency as any;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.default_weekly_hours !== undefined) data.default_weekly_hours = dto.default_weekly_hours ? new Decimal(dto.default_weekly_hours) : null;
    if (dto.work_schedule !== undefined) data.work_schedule = dto.work_schedule as any;
    if (dto.renewal_date !== undefined) data.renewal_date = dto.renewal_date ? new Date(dto.renewal_date) : null;
    if (dto.terms_summary !== undefined) data.terms_summary = dto.terms_summary;
    if (dto.change_reason !== undefined) data.change_reason = dto.change_reason;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.responsibilities !== undefined) data.responsibilities = dto.responsibilities;
    if (dto.work_address !== undefined) data.work_address = dto.work_address;
    if (dto.work_city !== undefined) data.work_city = dto.work_city;
    if (dto.work_state !== undefined) data.work_state = dto.work_state;
    if (dto.work_country !== undefined) data.work_country = dto.work_country;
    if (dto.work_postcode !== undefined) data.work_postcode = dto.work_postcode;
    if (dto.work_timezone !== undefined) data.work_timezone = dto.work_timezone;
    return data;
  }
}

interface CreateContractDtoLike {
  employee_id: string;
  start_date: string;
  end_date?: string;
  employment_type?: string;
  position?: string;
  department?: string;
  manager_id?: string;
  hourly_rate?: string;
  salary?: string;
  pay_frequency?: string;
  currency?: string;
  default_weekly_hours?: string;
  work_schedule?: Record<string, unknown>;
  renewal_date?: string;
  terms_summary?: string;
  change_reason?: string;
  notes?: string;
  responsibilities?: string;
  work_address?: string;
  work_city?: string;
  work_state?: string;
  work_country?: string;
  work_postcode?: string;
  work_timezone?: string;
}

interface UpdateContractDtoLike {
  start_date?: string;
  end_date?: string;
  employment_type?: string;
  position?: string;
  department?: string;
  manager_id?: string;
  hourly_rate?: string;
  salary?: string;
  pay_frequency?: string;
  currency?: string;
  default_weekly_hours?: string;
  work_schedule?: Record<string, unknown>;
  renewal_date?: string;
  terms_summary?: string;
  change_reason?: string;
  notes?: string;
  responsibilities?: string;
  work_address?: string;
  work_city?: string;
  work_state?: string;
  work_country?: string;
  work_postcode?: string;
  work_timezone?: string;
}
