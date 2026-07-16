import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UserLike {
  id: number;
  role: string;
}

const templateInclude = {
  profiles: { select: { id: true, first_name: true, last_name: true } },
};

const submissionInclude = {
  hr_form_templates: true,
  employees_hr_form_submissions_employee_idToemployees: {
    include: {
      profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
    },
  },
  employees_hr_form_submissions_current_handler_idToemployees: {
    include: {
      profiles: { select: { id: true, first_name: true, last_name: true } },
    },
  },
};

@Injectable()
export class HrFormsService {
  constructor(private readonly prisma: PrismaService) {}

  async findTemplates(query: Record<string, unknown>, user: UserLike) {
    const where: Prisma.hr_form_templatesWhereInput = {};
    const category = this.asString(query.category);
    if (category) where.category = category;
    if (this.parseBoolean(query.active_only) || !this.isAdminOrManager(user)) {
      where.is_active = true;
    }

    const templates = await this.prisma.hr_form_templates.findMany({
      where,
      include: templateInclude,
      orderBy: { title: 'asc' },
    });

    return { success: true, data: templates.map((t) => this.mapTemplate(t)) };
  }

  async findTemplate(id: number, user: UserLike) {
    const template = await this.prisma.hr_form_templates.findUnique({
      where: { id },
      include: templateInclude,
    });
    if (!template) throw new NotFoundException('Template not found');
    if (!template.is_active && !this.isAdminOrManager(user)) {
      throw new NotFoundException('Template not found');
    }
    return { success: true, data: this.mapTemplate(template) };
  }

  async createTemplate(user: UserLike, dto: Record<string, unknown>) {
    const title = this.asString(dto.title);
    if (!title?.trim()) throw new BadRequestException('Title is required');
    if (!Array.isArray(dto.structure)) throw new BadRequestException('Form structure must be an array of fields');

    const template = await this.prisma.hr_form_templates.create({
      data: {
        title: title.trim(),
        description: this.asString(dto.description),
        structure: dto.structure as any,
        workflow_config: (dto.workflow_config as any) ?? ({} as any),
        is_active: this.parseBoolean(dto.is_active) ?? true,
        category: this.asString(dto.category) || 'general',
        created_by: user.id,
      },
      include: templateInclude,
    });

    return { success: true, data: this.mapTemplate(template) };
  }

  async updateTemplate(id: number, dto: Record<string, unknown>) {
    const existing = await this.prisma.hr_form_templates.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Template not found');

    const data: Prisma.hr_form_templatesUpdateInput = {};
    if (dto.title !== undefined) data.title = this.asString(dto.title)?.trim();
    if (dto.description !== undefined) data.description = this.asString(dto.description);
    if (dto.structure !== undefined) {
      if (!Array.isArray(dto.structure)) throw new BadRequestException('Form structure must be an array');
      data.structure = dto.structure as any;
    }
    if (dto.workflow_config !== undefined) data.workflow_config = dto.workflow_config as any;
    if (dto.is_active !== undefined) data.is_active = this.parseBoolean(dto.is_active);
    if (dto.category !== undefined) data.category = this.asString(dto.category);

    const template = await this.prisma.hr_form_templates.update({
      where: { id },
      data,
      include: templateInclude,
    });

    return { success: true, data: this.mapTemplate(template) };
  }

  async removeTemplate(id: number) {
    const template = await this.prisma.hr_form_templates.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');

    const submissionCount = await this.prisma.hr_form_submissions.count({
      where: { template_id: id },
    });

    if (submissionCount > 0) {
      await this.prisma.hr_form_templates.update({ where: { id }, data: { is_active: false } });
      return { success: true, message: 'Template deactivated (has existing submissions)' };
    }

    await this.prisma.hr_form_templates.delete({ where: { id } });
    return { success: true, message: 'Template deleted' };
  }

  async findSubmissions(query: Record<string, unknown>, user: UserLike) {
    const employee = await this.getEmployeeForUser(user.id);
    const where: Prisma.hr_form_submissionsWhereInput = {};

    const templateId = this.asNumber(query.template_id);
    if (templateId) where.template_id = templateId;

    const status = this.asString(query.status);
    if (status) where.status = status as any;

    if (!this.isAdminOrManager(user)) {
      if (!employee) throw new ForbiddenException('Employee profile required');
      where.employee_id = employee.id;
    } else {
      const employeeId = this.asNumber(query.employee_id);
      if (employeeId) where.employee_id = employeeId;
    }

    if (this.parseBoolean(query.assigned_to_me) && employee) {
      where.current_handler_id = employee.id;
      where.status = 'pending';
      delete (where as any).employee_id;
    }

    const page = this.asNumber(String(query.page)) ?? 1;
    const limit = this.asNumber(String(query.limit)) ?? 20;

    const [rows, count] = await Promise.all([
      this.prisma.hr_form_submissions.findMany({
        where,
        include: submissionInclude,
        orderBy: { submitted_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.hr_form_submissions.count({ where }),
    ]);

    return {
      success: true,
      data: rows.map((s) => this.mapSubmission(s)),
      pagination: {
        total: count,
        page,
        pages: Math.ceil(count / limit),
      },
    };
  }

  async findSubmission(id: number, user: UserLike) {
    const submission = await this.prisma.hr_form_submissions.findUnique({
      where: { id },
      include: submissionInclude,
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const employee = await this.getEmployeeForUser(user.id);
    const isOwner = employee?.id === submission.employee_id;
    const isHandler = employee?.id === submission.current_handler_id;
    if (!isOwner && !isHandler && !this.isAdminOrManager(user)) {
      throw new ForbiddenException('Not authorized to view this submission');
    }

    return { success: true, data: this.mapSubmission(submission) };
  }

  async createSubmission(user: UserLike, dto: Record<string, unknown>) {
    const employee = await this.getEmployeeForUser(user.id);
    if (!employee) throw new NotFoundException('Employee profile not found');

    const templateId = this.asNumber(dto.template_id);
    if (!templateId) throw new BadRequestException('Template ID is required');

    const template = await this.prisma.hr_form_templates.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template not found');

    const isDraft = this.asString(dto.status) === 'draft';
    let status: any = 'pending';
    let currentHandlerId: number | null = null;

    const workflow = (dto.workflow_config as Record<string, unknown>) || (template.workflow_config as Record<string, unknown>) || {};

    if (workflow.approval_required === false) {
      status = 'approved' as any;
    } else {
      if (workflow.approver_role === 'manager') {
        currentHandlerId = employee.manager_id ?? null;
      } else if (workflow.approver_role === 'specific' && workflow.approver_id) {
        currentHandlerId = this.asNumber(workflow.approver_id) ?? null;
      }
    }

    const submission = await this.prisma.hr_form_submissions.create({
      data: {
        template_id: templateId,
        employee_id: employee.id,
        data: dto.data as any,
        status: isDraft ? 'draft' : (status),
        submitted_at: isDraft ? null : new Date(),
        current_handler_id: isDraft ? null : currentHandlerId,
      },
      include: submissionInclude,
    });

    return {
      success: true,
      data: this.mapSubmission(submission),
      message: status === 'approved' ? 'Form submitted and auto-approved' : 'Form submitted for review',
    };
  }

  async updateSubmissionStatus(id: number, user: UserLike, dto: Record<string, unknown>) {
    const submission = await this.prisma.hr_form_submissions.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException('Submission not found');

    const employee = await this.getEmployeeForUser(user.id);
    const isHandler = employee?.id === submission.current_handler_id;
    if (!isHandler && !this.isAdminOrManager(user)) {
      throw new ForbiddenException('Not authorized to review this submission');
    }

    const status = this.asString(dto.status);
    if (status !== 'approved' && status !== 'rejected') {
      throw new BadRequestException('Status must be approved or rejected');
    }

    const updated = await this.prisma.hr_form_submissions.update({
      where: { id },
      data: {
        status: status as any,
        reviewer_notes: this.asString(dto.notes),
        current_handler_id: null,
        completed_at: new Date(),
      },
      include: submissionInclude,
    });

    return { success: true, data: this.mapSubmission(updated) };
  }

  private async getEmployeeForUser(userId: number) {
    return this.prisma.employees.findUnique({ where: { user_id: userId } });
  }

  private isAdminOrManager(user: UserLike) {
    return ['admin', 'manager'].includes(user.role.toLowerCase());
  }

  private mapTemplate(template: any) {
    return {
      id: template.id,
      title: template.title,
      description: template.description,
      structure: template.structure,
      workflow_config: template.workflow_config,
      is_active: template.is_active,
      category: template.category,
      created_by: template.created_by,
      creator: template.profiles,
      created_at: template.created_at,
      updated_at: template.updated_at,
    };
  }

  private mapSubmission(s: any) {
    return {
      id: s.id,
      template_id: s.template_id,
      template: s.hr_form_templates,
      employee_id: s.employee_id,
      employee: (s).employees_hr_form_submissions_employee_idToemployees,
      data: s.data,
      status: s.status,
      current_handler_id: s.current_handler_id,
      handler: (s).employees_hr_form_submissions_current_handler_idToemployees,
      reviewer_notes: s.reviewer_notes,
      submitted_at: s.submitted_at,
      completed_at: s.completed_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
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
