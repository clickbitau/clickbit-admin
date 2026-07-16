import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, departments } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const departmentInclude = {
  companies: { select: { id: true, name: true } },
  profiles: { select: { id: true, first_name: true, last_name: true, email: true } },
  departments: { select: { id: true, name: true } },
  other_departments: { select: { id: true, name: true } },
  employees: {
    select: {
      id: true,
      user_id: true,
      profiles: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
  },
};

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: Record<string, unknown>) {
    const where: Prisma.departmentsWhereInput = { deleted_at: null };

    const companyId = this.asNumber(query.company_id);
    if (companyId) where.company_id = companyId;
    if (!this.parseBoolean(query.include_inactive)) {
      where.is_active = true;
    }

    const departments = await this.prisma.departments.findMany({
      where,
      include: {
        companies: true,
        profiles: true,
        departments: true,
      },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: departments.map((d) => this.mapDepartment(d)) };
  }

  async findOne(id: number) {
    const department = await this.prisma.departments.findUnique({
      where: { id, deleted_at: null },
      include: departmentInclude,
    });
    if (!department) throw new NotFoundException('Department not found');
    return { success: true, data: this.mapDepartment(department) };
  }

  async create(dto: Record<string, unknown>) {
    const name = this.asString(dto.name);
    if (!name?.trim()) throw new BadRequestException('Department name is required');

    const data: Prisma.departmentsUncheckedCreateInput = {
      name: name.trim(),
      code: this.asString(dto.code)?.trim() ?? null,
      company_id: this.asNumber(dto.company_id) ?? null,
      parent_department_id: this.asNumber(dto.parent_department_id) ?? null,
      head_id: this.asNumber(dto.head_id) ?? null,
      budget_allocated: this.asString(dto.budget_allocated) ?? null,
      description: this.asString(dto.description) ?? null,
      is_active: true,
    };

    const department = await this.prisma.departments.create({
      data,
      include: {
        companies: true,
        profiles: true,
        departments: true,
      },
    });

    return { success: true, data: this.mapDepartment(department), message: 'Department created successfully' };
  }

  async update(id: number, dto: Record<string, unknown>) {
    const existing = await this.prisma.departments.findUnique({
      where: { id, deleted_at: null },
    });
    if (!existing) throw new NotFoundException('Department not found');

    const parentId = this.asNumber(dto.parent_department_id);
    if (parentId && parentId === id) {
      throw new BadRequestException('Department cannot be its own parent');
    }

    const data: Prisma.departmentsUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = this.asString(dto.name)?.trim() || existing.name;
    if (dto.code !== undefined) data.code = this.asString(dto.code)?.trim() ?? null;
    if (dto.company_id !== undefined) data.company_id = this.asNumber(dto.company_id) ?? null;
    if (dto.parent_department_id !== undefined) data.parent_department_id = this.asNumber(dto.parent_department_id) ?? null;
    if (dto.head_id !== undefined) data.head_id = this.asNumber(dto.head_id) ?? null;
    if (dto.budget_allocated !== undefined) data.budget_allocated = this.asString(dto.budget_allocated) ?? null;
    if (dto.description !== undefined) data.description = this.asString(dto.description) ?? null;
    if (dto.is_active !== undefined) data.is_active = this.parseBoolean(dto.is_active);

    const department = await this.prisma.departments.update({
      where: { id },
      data,
      include: {
        companies: true,
        profiles: true,
        departments: true,
      },
    });

    return { success: true, data: this.mapDepartment(department), message: 'Department updated successfully' };
  }

  async remove(id: number) {
    const existing = await this.prisma.departments.findUnique({
      where: { id, deleted_at: null },
    });
    if (!existing) throw new NotFoundException('Department not found');

    const employeeCount = await this.prisma.employees.count({
      where: { department_id: id, deleted_at: null },
    });
    if (employeeCount > 0) {
      throw new BadRequestException(
        `Cannot delete department with ${employeeCount} employees. Reassign employees first.`,
      );
    }

    const subDeptCount = await this.prisma.departments.count({
      where: { parent_department_id: id, deleted_at: null },
    });
    if (subDeptCount > 0) {
      throw new BadRequestException(
        `Cannot delete department with ${subDeptCount} sub-departments. Remove sub-departments first.`,
      );
    }

    await this.prisma.departments.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return { success: true, message: 'Department deleted successfully' };
  }

  async hierarchy(id: number) {
    const department = await this.prisma.departments.findUnique({
      where: { id, deleted_at: null },
      include: { companies: true, profiles: true },
    });
    if (!department) throw new NotFoundException('Department not found');

    const ancestors = await this.getAncestors(id);
    const children = await this.getChildren(id);

    return {
      success: true,
      data: {
        current: this.mapDepartment(department),
        ancestors,
        children,
      },
    };
  }

  private async getAncestors(id: number): Promise<Record<string, unknown>[]> {
    const ancestors: Record<string, unknown>[] = [];
    let currentId: number | null = id;
    while (currentId) {
      const dept = (await this.prisma.departments.findUnique({
        where: { id: currentId },
        select: { id: true, parent_department_id: true, name: true },
      }));
      if (!dept || !dept.parent_department_id) break;
      const parent = (await this.prisma.departments.findUnique({
        where: { id: dept.parent_department_id },
        select: {
          id: true,
          name: true,
          code: true,
          company_id: true,
          parent_department_id: true,
          head_id: true,
          budget_allocated: true,
          description: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          deleted_at: true,
          companies: { select: { id: true, name: true } },
          profiles: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      })) as (departments & Record<string, unknown>) | null;
      if (!parent) break;
      ancestors.unshift(this.mapDepartment(parent));
      currentId = parent.parent_department_id;
    }
    return ancestors;
  }

  private async getChildren(id: number): Promise<Record<string, unknown>[]> {
    const children = await this.prisma.departments.findMany({
      where: { parent_department_id: id, deleted_at: null },
      include: { companies: true, profiles: true },
    });
    return children.map((d) => this.mapDepartment(d));
  }

  private mapDepartment(dept: departments & Record<string, unknown>): Record<string, unknown> {
    return {
      id: dept.id,
      name: dept.name,
      code: dept.code,
      company_id: dept.company_id,
      company: (dept as any).companies,
      parent_department_id: dept.parent_department_id,
      parentDepartment: (dept as any).departments,
      head_id: dept.head_id,
      head: (dept as any).profiles,
      subDepartments: (dept as any).other_departments,
      budget_allocated: dept.budget_allocated,
      description: dept.description,
      is_active: dept.is_active,
      employees: (dept as any).employees,
      created_at: dept.created_at,
      updated_at: dept.updated_at,
      deleted_at: dept.deleted_at,
    };
  }

  private asString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value;
    return undefined;
  }

  private asNumber(value: unknown): number | undefined {
    const str = this.asString(value);
    if (!str) return undefined;
    const num = Number(str);
    return Number.isNaN(num) ? undefined : num;
  }

  private parseBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return undefined;
  }
}
