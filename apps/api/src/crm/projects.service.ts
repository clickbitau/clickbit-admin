import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateProjectTaskDto,
  CreateSubprojectDto,
  UpdateSubprojectDto,
  CreateMeetingDto,
  UpdateMeetingDto,
  SendSupportEmailDto,
} from './dto';
import { asJsonInput, buildLegacyList, buildPagination, mapProjectSupportPeriod, mapSubprojectSupportPeriod, safeDate } from './crm-utils';
import { CacheService } from '../redis/cache.service';
import { EmailService } from '../common/email.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private readonly emailService?: EmailService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('projects', ...parts) ?? `projects:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  async findAll(query: { status?: string; search?: string; company_id?: string | number; contact_id?: string | number; manager_id?: string | number; page?: number; limit?: number; sortBy?: string; sortOrder?: string; sort?: string; order?: string }) {
    return this.cached(this.cacheKey('list', JSON.stringify(query)), async () => {
    const { status, search, page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC' } = query;
    const companyId = query.company_id ? Number(query.company_id) : undefined;
    const contactId = query.contact_id ? Number(query.contact_id) : undefined;
    const managerId = query.manager_id ? Number(query.manager_id) : undefined;
    const finalSortBy = query.sort || sortBy;
    const finalSortOrder = (query.order || sortOrder) as 'asc' | 'desc' | 'ASC' | 'DESC';
    const where: { [key: string]: unknown } = { deleted_at: null };
    if (status) where.status = status;
    if (companyId) where.company_id = companyId;
    if (contactId) where.customer_id = contactId;
    if (managerId) where.manager_id = managerId;
    if (search) {
      (where as { AND: unknown[] }).AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { project_number: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const orderBy: { [key: string]: 'asc' | 'desc' } = {
      [finalSortBy || 'created_at']: finalSortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [projects, total, stats] = await Promise.all([
      this.prisma.crm_projects.findMany({
        where,
        include: {
          companies: { select: { id: true, name: true, logo_url: true } },
          contacts: { select: { id: true, name: true, email: true } },
          deals: { select: { id: true, deal_number: true, title: true, value: true } },
          profiles_crm_projects_manager_idToprofiles: { select: { id: true, first_name: true, last_name: true } },
          profiles_crm_projects_created_byToprofiles: { select: { id: true, first_name: true, last_name: true } },
        },
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.crm_projects.count({ where }),
      this.projectStats(where),
    ]);

    return { ...buildLegacyList('projects', projects.map((p) => this.mapProject(p)), total, page, limit), stats };
    });
  }

  async findOne(id: number) {
    return this.cached(this.cacheKey('detail', id), async () => {
    const project = await this.prisma.crm_projects.findUnique({
      where: { id },
      include: {
        companies: { select: { id: true, name: true, logo_url: true } },
        contacts: { select: { id: true, name: true, email: true } },
        deals: { select: { id: true, deal_number: true, title: true, value: true } },
        profiles_crm_projects_manager_idToprofiles: { select: { id: true, first_name: true, last_name: true } },
        profiles_crm_projects_created_byToprofiles: { select: { id: true, first_name: true, last_name: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    const mapped = this.mapProject(project);
    mapped.financials = await this.projectFinancials(id);
    return { project: mapped };
    });
  }

  async create(userId: number, dto: CreateProjectDto) {
    const project = await this.prisma.crm_projects.create({
      data: this.buildProjectData(userId, dto) as unknown as Prisma.crm_projectsUncheckedCreateInput,
    });
    await this.invalidateCache();
    return this.findOne(project.id);
  }

  async update(id: number, dto: UpdateProjectDto) {
    const existing = await this.prisma.crm_projects.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Project not found');

    await this.prisma.crm_projects.update({
      where: { id },
      data: this.buildProjectData(existing.created_by || 0, dto, existing),
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return this.findOne(id);
  }

  async delete(id: number) {
    const existing = await this.prisma.crm_projects.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Project not found');
    await this.prisma.crm_projects.update({ where: { id }, data: { deleted_at: new Date() } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Project deleted successfully' };
  }

  async findRelated(id: number) {
    return this.getRelated(id);
  }

  async getRelated(id: number) {
    const project = await this.ensureProjectExists(id);

    const [tasks, subprojects, documents, meetings, contacts, companies, invoices, expenses, tickets, payments, financials] = await Promise.all([
      this.prisma.project_tasks.findMany({ where: { crm_project_id: id, deleted_at: null } }),
      this.prisma.crm_subprojects.findMany({ where: { parent_project_id: id, deleted_at: null } }),
      this.prisma.crm_project_documents.findMany({ where: { project_id: id } }),
      this.prisma.crm_meetings.findMany({ where: { crm_project_id: id } }),
      this.prisma.contacts.findMany({ where: { company_id: project.company_id, deleted_at: null } }),
      project.company_id ? this.prisma.companies.findUnique({ where: { id: project.company_id } }) : Promise.resolve(null),
      this.prisma.invoices.findMany({ where: { crm_project_id: id, deleted_at: null }, orderBy: { created_at: 'desc' } }),
      this.prisma.expenses.findMany({ where: { crm_project_id: id }, orderBy: { created_at: 'desc' } }),
      this.prisma.tickets.findMany({ where: { crm_project_id: id, deleted_at: null }, orderBy: { created_at: 'desc' } }),
      this.prisma.payments.findMany({ where: { crm_project_id: id, deleted_at: null }, orderBy: { created_at: 'desc' } }),
      this.projectFinancials(id),
    ]);

    return {
      project_id: id,
      tasks,
      subprojects,
      documents,
      meetings,
      contacts,
      companies,
      invoices,
      expenses,
      tickets,
      payments,
      financials,
    };
  }

  async getTasks(id: number, page = 1, limit = 50) {
    await this.ensureProjectExists(id);
    const where = { crm_project_id: id, deleted_at: null };

    const [tasks, total] = await Promise.all([
      this.prisma.project_tasks.findMany({
        where,
        include: {
          crm_projects: { select: { id: true, project_number: true, name: true } },
          profiles_project_tasks_assigned_toToprofiles: {
            select: { id: true, email: true, first_name: true, last_name: true, avatar: true, role: true },
          },
          profiles_project_tasks_created_byToprofiles: {
            select: { id: true, email: true, first_name: true, last_name: true, avatar: true, role: true },
          },
          contacts: { select: { id: true, name: true, email: true, avatar_url: true } },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.project_tasks.count({ where }),
    ]);

    const stats = await this.taskStats(where);
    return { tasks: tasks.map((t) => this.mapTask(t)), stats, pagination: buildPagination(total, page, limit) };
  }

  async createTask(id: number, dto: CreateProjectTaskDto, userId: number) {
    await this.ensureProjectExists(id);

    const task = await this.prisma.project_tasks.create({
      data: {
        crm_project_id: id,
        title: dto.title,
        description: dto.description,
        status: dto.status || 'todo',
        priority: dto.priority || 'medium',
        assigned_to: dto.assigned_to,
        estimated_hours: typeof dto.estimated_hours === 'string' ? parseFloat(dto.estimated_hours) : Number(dto.estimated_hours ?? 0),
        due_date: safeDate(dto.due_date),
        parent_task_id: dto.parent_task_id,
        created_by: userId,
        tags: asJsonInput(dto.tags),
      },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Task created successfully', data: task };
  }

  async getSubprojects(id: number, page = 1, limit = 50) {
    await this.ensureProjectExists(id);
    const where = { parent_project_id: id, deleted_at: null };

    const [subprojects, total] = await Promise.all([
      this.prisma.crm_subprojects.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.crm_subprojects.count({ where }),
    ]);

    return buildLegacyList('subprojects', subprojects, total, page, limit);
  }

  async createSubproject(id: number, dto: CreateSubprojectDto, userId: number) {
    await this.ensureProjectExists(id);

    const subproject = await this.prisma.crm_subprojects.create({
      data: this.buildSubprojectData(id, userId, dto) as unknown as Prisma.crm_subprojectsUncheckedCreateInput,
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { data: subproject };
  }

  async updateSubproject(subprojectId: number, dto: UpdateSubprojectDto) {
    const existing = await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } });
    if (!existing) throw new NotFoundException('Subproject not found');

    await this.prisma.crm_subprojects.update({
      where: { id: subprojectId },
      data: this.buildSubprojectData(existing.parent_project_id, existing.created_by || 0, dto, existing),
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', existing.parent_project_id));
    return { data: await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } }) };
  }

  async deleteSubproject(subprojectId: number) {
    const existing = await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } });
    if (!existing) throw new NotFoundException('Subproject not found');
    await this.prisma.crm_subprojects.update({ where: { id: subprojectId }, data: { deleted_at: new Date() } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', existing.parent_project_id));
    return { message: 'Subproject deleted successfully' };
  }

  async getDocuments(id: number, page = 1, limit = 50) {
    await this.ensureProjectExists(id);
    const [documents, total] = await Promise.all([
      this.prisma.crm_project_documents.findMany({
        where: { project_id: id },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.crm_project_documents.count({ where: { project_id: id } }),
    ]);

    return buildLegacyList('documents', documents, total, page, limit);
  }

  async uploadDocument(id: number, file: { buffer?: Buffer; originalname?: string; mimetype?: string; size?: number }, userId: number) {
    await this.ensureProjectExists(id);

    const document = await this.prisma.crm_project_documents.create({
      data: {
        project_id: id,
        file_name: file.originalname || 'document',
        file_url: '/uploads/projects/' + file.originalname,
        file_size: file.size || 0,
        file_type: file.mimetype || 'application/octet-stream',
        uploaded_by: userId,
      },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { data: document };
  }

  async deleteDocument(id: number, documentId: number) {
    await this.ensureProjectExists(id);
    const doc = await this.prisma.crm_project_documents.findUnique({ where: { id: documentId } });
    if (!doc || doc.project_id !== id) throw new NotFoundException('Document not found');
    await this.prisma.crm_project_documents.delete({ where: { id: documentId } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Document deleted successfully' };
  }

  async getMeetings(id: number, page = 1, limit = 50) {
    await this.ensureProjectExists(id);
    const where = { crm_project_id: id };

    const [meetings, total] = await Promise.all([
      this.prisma.crm_meetings.findMany({
        where,
        orderBy: { meeting_date: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.crm_meetings.count({ where }),
    ]);

    return buildLegacyList('meetings', meetings, total, page, limit);
  }

  async createMeeting(id: number, dto: CreateMeetingDto, userId: number) {
    await this.ensureProjectExists(id);

    const meeting = await this.prisma.crm_meetings.create({
      data: {
        crm_project_id: id,
        title: dto.title,
        participants: dto.participants,
        meeting_date: new Date(dto.meeting_date),
        duration_minutes: dto.duration_minutes || 60,
        notes: dto.notes,
        status: dto.status || 'scheduled',
        created_by: userId,
      },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { data: meeting };
  }

  async updateMeeting(id: number, meetingId: number, dto: UpdateMeetingDto) {
    await this.ensureProjectExists(id);
    const existing = await this.prisma.crm_meetings.findUnique({ where: { id: meetingId } });
    if (!existing || existing.crm_project_id !== id) throw new NotFoundException('Meeting not found');

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.participants !== undefined) data.participants = dto.participants;
    if (dto.meeting_date !== undefined) data.meeting_date = new Date(dto.meeting_date);
    if (dto.duration_minutes !== undefined) data.duration_minutes = dto.duration_minutes;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status !== undefined) data.status = dto.status;

    await this.prisma.crm_meetings.update({
      where: { id: meetingId },
      data: data,
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { data: await this.prisma.crm_meetings.findUnique({ where: { id: meetingId } }) };
  }

  async deleteMeeting(id: number, meetingId: number) {
    await this.ensureProjectExists(id);
    const existing = await this.prisma.crm_meetings.findUnique({ where: { id: meetingId } });
    if (!existing || existing.crm_project_id !== id) throw new NotFoundException('Meeting not found');
    await this.prisma.crm_meetings.delete({ where: { id: meetingId } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Meeting deleted successfully' };
  }

  async updateStatus(id: number, body: { status?: string; completion_percentage?: number }) {
    await this.ensureProjectExists(id);

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.completion_percentage !== undefined) data.progress_percentage = Number(body.completion_percentage);
    if (body.status === 'completed') data.completed_date = new Date();

    await this.prisma.crm_projects.update({
      where: { id },
      data: data,
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return this.findOne(id);
  }

  async recalculateProgress(id: number) {
    await this.ensureProjectExists(id);

    const subprojects = await this.prisma.crm_subprojects.findMany({ where: { parent_project_id: id, deleted_at: null } });
    const tasks = await this.prisma.project_tasks.findMany({ where: { crm_project_id: id, deleted_at: null } });

    const subAvg = subprojects.length ? subprojects.reduce((sum, s) => sum + (s.progress_percentage || 0), 0) / subprojects.length : 0;
    const taskAvg = tasks.length ? tasks.reduce((sum, t) => sum + (t.status === 'completed' ? 100 : 0), 0) / tasks.length : 0;
    const progress = Math.round((subAvg + taskAvg) / 2);

    await this.prisma.crm_projects.update({
      where: { id },
      data: { progress_percentage: progress },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { data: { project_id: id, progress_percentage: progress } };
  }

  async sendSupportEmail(id: number, dto: SendSupportEmailDto) {
    const project = await this.ensureProjectExists(id);
    let recipientEmail = dto.email;
    let recipientName = dto.name || 'Valued Client';
    if (!recipientEmail && project.customer_id) {
      const contact = await this.prisma.contacts.findUnique({ where: { id: project.customer_id }, select: { email: true, name: true } });
      if (contact?.email) {
        recipientEmail = contact.email;
        recipientName = contact.name || recipientName;
      }
    }
    if (!recipientEmail) {
      return { success: false, message: 'No recipient email found. Provide email in body.' };
    }

    const periodLabels: Record<string, string> = {
      '3_months': '3 Months', '6_months': '6 Months', '1_year': '1 Year',
      '2_years': '2 Years', '3_years': '3 Years', '5_years': '5 Years',
      lifetime: 'Lifetime', custom: 'Custom',
    };
    const supportStatus = this.getSupportStatus(project);

    if (!this.emailService) {
      return { success: false, message: 'Email service not available' };
    }

    const result = await this.emailService.send({
      to: recipientEmail,
      subject: dto.subject || `Support Period Reminder - ${(project as any).name}`,
      html: `
        <div style="font-family: Sora, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
          <h2 style="color: #1FBBD2;">Hi ${recipientName},</h2>
          <p>This is a reminder about the support period for <strong>${(project as any).name}</strong>.</p>
          <p><strong>Support period:</strong> ${periodLabels[(project as any).support_period_type] || (project as any).support_period_type || '—'}<br/>
          <strong>Support end date:</strong> ${(project as any).support_end_date ? new Date((project as any).support_end_date).toLocaleDateString('en-AU') : '—'}<br/>
          <strong>Status:</strong> ${supportStatus.status}<br/>
          <strong>Days remaining:</strong> ${supportStatus.daysRemaining}<br/>
          ${(project as any).support_price ? `<strong>Support price:</strong> ${(project as any).support_currency || 'AUD'} ${Number((project as any).support_price).toLocaleString('en-AU', { minimumFractionDigits: 2 })}<br/>` : ''}
          </p>
          ${dto.body ? `<p>${dto.body}</p>` : '<p>If you have any questions, please contact us.</p>'}
        </div>
      `,
    });

    if (!result.sent) {
      return { success: false, message: result.error || 'Failed to send support email' };
    }
    return { success: true, message: 'Support expiry email sent successfully', sentTo: recipientEmail };
  }

  async sendSubprojectSupportEmail(id: number, subprojectId: number, dto: SendSupportEmailDto) {
    const project = await this.ensureProjectExists(id);
    const subproject = await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } });
    if (!subproject || subproject.parent_project_id !== id) {
      throw new NotFoundException('Subproject not found');
    }
    if (!subproject.support_period_type) {
      throw new BadRequestException('No support period configured for this subproject');
    }

    let recipientEmail = dto.email;
    let recipientName = dto.name || 'Valued Client';
    if (!recipientEmail && project.customer_id) {
      const contact = await this.prisma.contacts.findUnique({ where: { id: project.customer_id }, select: { email: true, name: true } });
      if (contact?.email) {
        recipientEmail = contact.email;
        recipientName = contact.name || recipientName;
      }
    }
    if (!recipientEmail) {
      throw new BadRequestException('No recipient email found. Provide an email address.');
    }

    const supportStatus = this.getSupportStatus(subproject);
    const periodLabels: Record<string, string> = {
      '3_months': '3 Months', '6_months': '6 Months', '1_year': '1 Year',
      '2_years': '2 Years', '3_years': '3 Years', '5_years': '5 Years',
      lifetime: 'Lifetime', custom: 'Custom',
    };

    if (!this.emailService) {
      return { success: false, message: 'Email service not available' };
    }

    const result = await this.emailService.send({
      to: recipientEmail,
      subject: dto.subject || `Support Period Reminder - ${subproject.name}`,
      html: `
        <div style="font-family: Sora, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
          <h2 style="color: #1FBBD2;">Hi ${recipientName},</h2>
          <p>This is a reminder about the support period for <strong>${subproject.name}</strong> (subproject of ${project.name}).</p>
          <p><strong>Support period:</strong> ${periodLabels[subproject.support_period_type as string] || subproject.support_period_type}<br/>
          <strong>Support end date:</strong> ${subproject.support_end_date ? new Date(subproject.support_end_date).toLocaleDateString('en-AU') : '—'}<br/>
          <strong>Status:</strong> ${supportStatus.status}<br/>
          <strong>Days remaining:</strong> ${supportStatus.daysRemaining}<br/>
          ${subproject.support_price ? `<strong>Support price:</strong> ${subproject.support_currency || 'AUD'} ${Number(subproject.support_price).toLocaleString('en-AU', { minimumFractionDigits: 2 })}<br/>` : ''}
          </p>
          ${dto.body ? `<p>${dto.body}</p>` : '<p>If you have any questions, please contact us.</p>'}
        </div>
      `,
    });

    if (!result.sent) {
      return { success: false, message: result.error || 'Failed to send support email' };
    }
    return { success: true, message: 'Support expiry email sent successfully', sentTo: recipientEmail };
  }

  private getSupportStatus(record: { support_period_type: string | null; support_end_date: Date | string | null }) {
    if (record.support_period_type === 'lifetime') {
      return { status: 'active', daysRemaining: 9999 };
    }
    const end = record.support_end_date ? new Date(record.support_end_date) : null;
    if (!end) {
      return { status: 'unknown', daysRemaining: 0 };
    }
    const daysRemaining = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) return { status: 'expired', daysRemaining };
    if (daysRemaining <= 30) return { status: 'expiring', daysRemaining };
    return { status: 'active', daysRemaining };
  }

  async getSubproject(subprojectId: number) {
    const sub = await this.prisma.crm_subprojects.findUnique({
      where: { id: subprojectId },
      include: {
        profiles_crm_subprojects_manager_idToprofiles: { select: { id: true, first_name: true, last_name: true } },
      },
    });
    if (!sub) throw new NotFoundException('Subproject not found');
    return sub;
  }

  async getMeeting(meetingId: number) {
    const meeting = await this.prisma.crm_meetings.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async getSubprojectDocuments(subprojectId: number, page = 1, limit = 50) {
    const sub = await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } });
    if (!sub) throw new NotFoundException('Subproject not found');

    const [documents, total] = await Promise.all([
      this.prisma.crm_subproject_documents.findMany({
        where: { subproject_id: subprojectId },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.crm_subproject_documents.count({ where: { subproject_id: subprojectId } }),
    ]);

    return buildLegacyList('documents', documents, total, page, limit);
  }

  async uploadSubprojectDocument(subprojectId: number, file: { buffer?: Buffer; originalname?: string; mimetype?: string; size?: number }, userId: number) {
    const sub = await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } });
    if (!sub) throw new NotFoundException('Subproject not found');

    const document = await this.prisma.crm_subproject_documents.create({
      data: {
        subproject_id: subprojectId,
        file_name: file.originalname || 'document',
        file_url: '/uploads/subprojects/' + file.originalname,
        file_size: file.size || 0,
        file_type: file.mimetype || 'application/octet-stream',
        uploaded_by: userId,
      },
    });

    return { data: document };
  }

  async deleteSubprojectDocument(subprojectId: number, documentId: number) {
    const doc = await this.prisma.crm_subproject_documents.findUnique({ where: { id: documentId } });
    if (!doc || doc.subproject_id !== subprojectId) throw new NotFoundException('Document not found');
    await this.prisma.crm_subproject_documents.delete({ where: { id: documentId } });
    return { message: 'Subproject document deleted successfully' };
  }

  async getSubprojectMeetings(subprojectId: number, page = 1, limit = 50) {
    const sub = await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } });
    if (!sub) throw new NotFoundException('Subproject not found');

    // Meetings table has crm_project_id only; filter by subproject relation not directly available.
    // Return empty list for subproject-specific meetings.
    return buildLegacyList('meetings', [], 0, page, limit);
  }

  async updateSubprojectSupport(subprojectId: number, dto: Partial<CreateSubprojectDto>) {
    const existing = await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } });
    if (!existing) throw new NotFoundException('Subproject not found');

    const data: Record<string, unknown> = {};
    if (dto.support_period_type !== undefined) data.support_period_type = mapSubprojectSupportPeriod(dto.support_period_type);
    if (dto.support_start_date !== undefined) data.support_start_date = safeDate(dto.support_start_date);
    if (dto.support_end_date !== undefined) data.support_end_date = safeDate(dto.support_end_date);
    if (dto.support_price !== undefined) data.support_price = typeof dto.support_price === 'string' ? parseFloat(dto.support_price) || 0 : Number(dto.support_price ?? 0);
    if (dto.support_currency !== undefined) data.support_currency = dto.support_currency;
    if (dto.support_notes !== undefined) data.support_notes = dto.support_notes;

    await this.prisma.crm_subprojects.update({
      where: { id: subprojectId },
      data: data,
    });

    return { data: await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } }) };
  }

  private async ensureProjectExists(id: number) {
    const project = await this.prisma.crm_projects.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async projectStats(where: { [key: string]: unknown }) {
    const counts = await this.prisma.crm_projects.groupBy({
      by: ['status'],
      where: where as any,
      _count: { status: true },
    });
    const statusMap: Record<string, string> = {
      not_started: 'notStarted',
      in_progress: 'inProgress',
      completed: 'completed',
      on_hold: 'onHold',
      cancelled: 'cancelled',
    };
    const stats: Record<string, number> = { total: 0, notStarted: 0, inProgress: 0, completed: 0, onHold: 0, cancelled: 0 };
    for (const row of counts) {
      const count = Number(row._count.status || 0);
      stats.total += count;
      const key = statusMap[row.status || ''];
      if (key) stats[key] += count;
    }
    return stats as { total: number; notStarted: number; inProgress: number; completed: number; onHold: number; cancelled: number };
  }

  private async projectFinancials(id: number) {
    try {
      const invoiceRows = await this.prisma.invoices.findMany({
        where: { crm_project_id: id, deleted_at: null, status: { notIn: ['void', 'cancelled', 'canceled'] } },
        select: { total_amount: true, amount_paid: true, status: true },
      });
      const paymentRows = await this.prisma.payments.findMany({
        where: { crm_project_id: id, deleted_at: null, status: { not: 'refunded' } },
        select: { amount: true, gateway_fee: true },
      });
      const expenseRows = await this.prisma.expenses.findMany({
        where: { crm_project_id: id },
        select: { total_amount: true },
      });

      const totalValue = invoiceRows.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
      const totalPaid = invoiceRows.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
      const totalPaymentsReceived = paymentRows.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalExpenses = expenseRows.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
      const totalFees = paymentRows.reduce((sum, p) => sum + Number(p.gateway_fee || 0), 0);
      const totalCosts = totalExpenses + totalFees;
      const netProfit = totalPaymentsReceived - totalCosts;

      return {
        totalValue,
        totalPaid,
        totalPaymentsReceived,
        totalExpenses,
        totalCosts,
        netProfit,
        labourCost: 0,
        invoiceCount: invoiceRows.length,
        estimateCount: 0,
        expenseCount: expenseRows.length,
        ticketCount: 0,
        taskCount: 0,
      };
    } catch {
      return {
        totalValue: 0,
        totalPaid: 0,
        totalPaymentsReceived: 0,
        totalExpenses: 0,
        totalCosts: 0,
        netProfit: 0,
        labourCost: 0,
        invoiceCount: 0,
        estimateCount: 0,
        expenseCount: 0,
        ticketCount: 0,
        taskCount: 0,
      };
    }
  }

  private async taskStats(where: { [key: string]: unknown }) {
    const counts = await this.prisma.project_tasks.groupBy({
      by: ['status'],
      where: where as any,
      _count: { status: true },
      _sum: { estimated_hours: true, actual_hours: true },
    });
    const byStatus = { total: 0, todo: 0, in_progress: 0, review: 0, completed: 0, blocked: 0 };
    for (const row of counts) {
      const count = Number(row._count.status || 0);
      byStatus.total += count;
      if (row.status in byStatus) {
        (byStatus as any)[row.status] += count;
      }
    }
    return {
      ...byStatus,
      totalEstimatedHours: Number(counts.reduce((sum, r) => sum + Number(r._sum.estimated_hours || 0), 0)),
      totalActualHours: Number(counts.reduce((sum, r) => sum + Number(r._sum.actual_hours || 0), 0)),
    };
  }

  private mapProject(project: any) {
    return {
      ...project,
      company: project.companies || null,
      customer: project.contacts || null,
      deal: project.deals || null,
      manager: project.profiles_crm_projects_manager_idToprofiles
        ? { id: project.profiles_crm_projects_manager_idToprofiles.id, name: `${project.profiles_crm_projects_manager_idToprofiles.first_name || ''} ${project.profiles_crm_projects_manager_idToprofiles.last_name || ''}`.trim() }
        : null,
      companies: undefined,
      contacts: undefined,
      deals: undefined,
      profiles_crm_projects_manager_idToprofiles: undefined,
    };
  }

  private mapTask(t: any) {
    return {
      ...t,
      estimated_hours: t.estimated_hours ? Number(t.estimated_hours) : undefined,
      actual_hours: t.actual_hours ? Number(t.actual_hours) : undefined,
      crmProject: t.crm_projects ? { id: t.crm_projects.id, project_number: t.crm_projects.project_number, name: t.crm_projects.name } : null,
      project: t.crm_projects ? { id: t.crm_projects.id, title: t.crm_projects.name } : null,
      assignee: t.profiles_project_tasks_assigned_toToprofiles
        ? this.mapUser(t.profiles_project_tasks_assigned_toToprofiles)
        : null,
      creator: t.profiles_project_tasks_created_byToprofiles
        ? this.mapUser(t.profiles_project_tasks_created_byToprofiles)
        : null,
      customer: t.contacts ? { ...t.contacts, avatar: t.contacts.avatar_url } : null,
    };
  }

  private mapUser(u: any) {
    return {
      ...u,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      avatar: u.avatar,
    };
  }

  private buildProjectData(userId: number, dto: any, existing?: { created_by?: number | null; [key: string]: unknown }) {
    const pick = (key: string, fallback?: unknown) => {
      if (dto[key] !== undefined) return dto[key];
      if (existing && existing[key] !== undefined) return existing[key];
      return fallback;
    };
    const num = (key: string, fallback: number) => {
      const v = pick(key);
      if (v === undefined || v === null || v === '') return fallback;
      return typeof v === 'string' ? parseFloat(v) || fallback : Number(v);
    };

    const data: Record<string, unknown> = {
      name: pick('name'),
      description: pick('description'),
      status: pick('status') ?? 'not_started',
      priority: pick('priority') ?? 'medium',
      budget: num('budget', 0),
      currency: pick('currency') ?? 'AUD',
      start_date: safeDate(pick('start_date') as string | undefined),
      due_date: safeDate(pick('due_date') as string | undefined),
      customer_id: pick('customer_id'),
      company_id: pick('company_id'),
      deal_id: pick('deal_id'),
      manager_id: pick('manager_id') || userId,
      created_by: existing?.created_by || userId,
      project_type: pick('project_type'),
      customer_visible: pick('customer_visible') ?? true,
      custom_fields: asJsonInput(pick('custom_fields')),
      tags: asJsonInput(pick('tags')),
      support_period_type: mapProjectSupportPeriod(pick('support_period_type') as string | undefined),
      support_start_date: safeDate(pick('support_start_date') as string | undefined),
      support_end_date: safeDate(pick('support_end_date') as string | undefined),
      support_price: num('support_price', 0),
      support_currency: pick('support_currency') ?? 'AUD',
      support_notes: pick('support_notes'),
      hourly_rate: num('hourly_rate', 0),
    };

    return data;
  }

  private buildSubprojectData(parentProjectId: number, userId: number, dto: any, existing?: { created_by?: number | null; [key: string]: unknown }) {
    const pick = (key: string, fallback?: unknown) => {
      if (dto[key] !== undefined) return dto[key];
      if (existing && existing[key] !== undefined) return existing[key];
      return fallback;
    };
    const num = (key: string, fallback: number) => {
      const v = pick(key);
      if (v === undefined || v === null || v === '') return fallback;
      return typeof v === 'string' ? parseFloat(v) || fallback : Number(v);
    };

    const data: Record<string, unknown> = {
      parent_project_id: parentProjectId,
      name: pick('name'),
      description: pick('description'),
      status: pick('status') ?? 'not_started',
      priority: pick('priority') ?? 'medium',
      budget: num('budget', 0),
      currency: pick('currency') ?? 'AUD',
      start_date: safeDate(pick('start_date') as string | undefined),
      due_date: safeDate(pick('due_date') as string | undefined),
      manager_id: pick('manager_id') || userId,
      created_by: existing?.created_by || userId,
      custom_fields: asJsonInput(pick('custom_fields')),
      tags: asJsonInput(pick('tags')),
      support_period_type: mapSubprojectSupportPeriod(pick('support_period_type') as string | undefined),
      support_start_date: safeDate(pick('support_start_date') as string | undefined),
      support_end_date: safeDate(pick('support_end_date') as string | undefined),
      support_price: num('support_price', 0),
      support_currency: pick('support_currency') ?? 'AUD',
      support_notes: pick('support_notes'),
    };

    return data;
  }
}
