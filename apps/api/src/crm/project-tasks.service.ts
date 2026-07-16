import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

interface UserLike {
  id: number;
  role: string;
}

function toNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Decimal) return value.toNumber();
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function toNum0(value: unknown): number {
  return toNum(value) ?? 0;
}

function formatDate(date: Date | null | undefined) {
  if (!date) return null;
  return new Date(date).toISOString().split('T')[0];
}

@Injectable()
export class ProjectTasksService {
  constructor(
    public readonly prisma: PrismaService,
    private readonly storage?: StorageService,
  ) {}

  get taskInclude(): any {
    return {
      project_phases: { select: { id: true, name: true, position: true, status: true } },
      crm_projects: { select: { id: true, project_number: true, name: true } },
      crm_subprojects: { select: { id: true, name: true } },
      contacts: { select: { id: true, name: true, email: true, avatar_url: true } },
      profiles_project_tasks_assigned_toToprofiles: {
        select: { id: true, email: true, first_name: true, last_name: true, avatar: true, role: true },
      },
      profiles_project_tasks_created_byToprofiles: {
        select: { id: true, email: true, first_name: true, last_name: true, avatar: true, role: true },
      },
      task_microtasks: { orderBy: { position: 'asc' } },
      recurring_task_configs: { select: { id: true, title: true, frequency: true } },
      deals: { select: { id: true, deal_number: true, title: true } },
      project_tasks: { select: { id: true, title: true, status: true } },
      other_project_tasks: { select: { id: true, title: true, status: true } },
    };
  }

  mapTask(t: any) {
    if (!t) return null;
    const assignee = t.profiles_project_tasks_assigned_toToprofiles
      ? this.mapUser(t.profiles_project_tasks_assigned_toToprofiles)
      : null;
    const creator = t.profiles_project_tasks_created_byToprofiles
      ? this.mapUser(t.profiles_project_tasks_created_byToprofiles)
      : null;
    const project = t.deals
      ? { id: t.deals.id, title: t.deals.title, deal_number: t.deals.deal_number }
      : t.crm_projects
        ? { id: t.crm_projects.id, title: t.crm_projects.name, project_number: t.crm_projects.project_number }
        : null;
    const crmProject = t.crm_projects
      ? { id: t.crm_projects.id, name: t.crm_projects.name, project_number: t.crm_projects.project_number }
      : null;
    const subproject = t.crm_subprojects ? { id: t.crm_subprojects.id, name: t.crm_subprojects.name } : null;
    const customer = t.contacts ? { ...t.contacts, avatar: t.contacts.avatar_url } : null;
    const parentTask = t.project_tasks ? { id: t.project_tasks.id, title: t.project_tasks.title, status: t.project_tasks.status } : null;
    const subTasks = Array.isArray(t.other_project_tasks) ? t.other_project_tasks : [];
    const phase = t.project_phases ? { id: t.project_phases.id, name: t.project_phases.name, position: t.project_phases.position, status: t.project_phases.status } : null;
    return {
      ...t,
      estimated_hours: toNum(t.estimated_hours),
      actual_hours: toNum(t.actual_hours),
      expected_duration_days: toNum(t.expected_duration_days),
      weight: toNum(t.weight),
      due_date: formatDate(t.due_date),
      start_date: formatDate(t.start_date),
      completed_at: t.completed_at ? new Date(t.completed_at).toISOString() : null,
      project,
      crmProject,
      subproject,
      phase,
      assignee,
      creator,
      customer,
      parentTask,
      subTasks,
      microtasks: t.task_microtasks || [],
    };
  }

  mapUser(u: any) {
    if (!u) return null;
    return {
      ...u,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      avatar: u.avatar,
    };
  }

  private async taskStats(where: any) {
    const counts = await this.prisma.project_tasks.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });
    const total = await this.prisma.project_tasks.count({ where });
    const sums = await this.prisma.project_tasks.aggregate({ where, _sum: { estimated_hours: true, actual_hours: true } });
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, Number(c._count.status)]));
    return {
      total,
      todo: byStatus['todo'] || 0,
      in_progress: byStatus['in_progress'] || 0,
      review: byStatus['review'] || 0,
      completed: byStatus['completed'] || 0,
      blocked: byStatus['blocked'] || 0,
      totalEstimatedHours: toNum0(sums._sum.estimated_hours),
      totalActualHours: toNum0(sums._sum.actual_hours),
    };
  }

  private buildWhere(query: Record<string, unknown>, base: any = {}) {
    const where: any = { deleted_at: null, ...base };
    const { status, priority, assigned_to, crm_project_id, subproject_id, customer_id, search, view_scope, user } = query as any;

    if (status && status !== 'all') where.status = status;
    if (priority && priority !== 'all') where.priority = priority;
    if (assigned_to && assigned_to !== 'all') {
      const ids = typeof assigned_to === 'string' && assigned_to.includes(',')
        ? assigned_to.split(',').map((x: string) => Number(x)).filter((x: number) => !Number.isNaN(x))
        : [Number(assigned_to)];
      where.assigned_to = ids.length === 1 ? ids[0] : { in: ids };
    }
    if (crm_project_id && crm_project_id !== 'all') where.crm_project_id = Number(crm_project_id);
    if (subproject_id && subproject_id !== 'all') where.subproject_id = Number(subproject_id);
    if (customer_id && customer_id !== 'all') where.customer_id = Number(customer_id);

    if (view_scope === 'my' && user) {
      where.assigned_to = user.id;
    }

    if (search) {
      const term = String(search);
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async resolveProjectEntity(projectId: number) {
    const project = await this.prisma.crm_projects.findUnique({ where: { id: projectId } });
    if (project) return { type: 'crm_project' as const, entity: project };
    const subproject = await this.prisma.crm_subprojects.findUnique({ where: { id: projectId } });
    if (subproject) return { type: 'subproject' as const, entity: subproject };
    const deal = await this.prisma.deals.findFirst({ where: { id: projectId, is_project: true } });
    if (deal) return { type: 'deal' as const, entity: deal };
    return null;
  }

  private ensureTaskAccess(task: any, user: UserLike) {
    if (['admin', 'manager'].includes(user.role)) return;
    if (task.assigned_to === user.id || task.created_by === user.id) return;
    if (user.role === 'customer' && (task.customer_visible || task.customer_id === user.id)) return;
    throw new ForbiddenException('You do not have access to this task');
  }

  // -------------------------------------------------------------------------
  // Standalone tasks
  // -------------------------------------------------------------------------
  async findAll(query: Record<string, unknown>) {
    const page = Math.max(1, Number((query as any).page ?? 1));
    const limit = Math.min(100, Math.max(1, Number((query as any).limit ?? 25)));
    const where = this.buildWhere(query);

    where.OR = [
      { phase_id: null },
      { project_phases: { status: { not: 'not_started' } } },
    ];

    const [tasks, total] = await Promise.all([
      this.prisma.project_tasks.findMany({
        where,
        include: this.taskInclude,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.project_tasks.count({ where }),
    ]);
    const stats = await this.taskStats(where);

    return {
      data: tasks.map((t) => this.mapTask(t)),
      stats,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit },
    };
  }

  async getMyTasks(user: UserLike, query: Record<string, unknown>) {
    const includeCompleted = String((query as any).include_completed ?? 'false') !== 'false';
    const projectId = (query as any).project_id ? Number((query as any).project_id) : undefined;
    const where: any = { deleted_at: null, assigned_to: user.id };
    if (!includeCompleted) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      where.OR = [
        { status: { notIn: ['completed'] } },
        { completed_at: { gte: yesterday } },
      ];
    }
    if (projectId) {
      where.OR = [{ crm_project_id: projectId }, { subproject_id: projectId }, { project_id: projectId }];
    }
    const tasks = await this.prisma.project_tasks.findMany({
      where,
      include: this.taskInclude,
      orderBy: [{ priority: 'desc' }, { due_date: 'asc' }],
    });
    return { success: true, tasks: tasks.map((t) => this.mapTask(t)) };
  }

  async getOverdueTasks(_user: UserLike) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const where: any = {
      deleted_at: null,
      status: { not: 'completed' },
      due_date: { lt: today },
    };
    const tasks = await this.prisma.project_tasks.findMany({
      where,
      include: this.taskInclude,
      orderBy: { due_date: 'asc' },
    });
    return { success: true, data: tasks.map((t) => this.mapTask(t)) };
  }

  async getCustomerTasks(user: UserLike, query: Record<string, unknown>) {
    const customerId = (query as any).customer_id ? Number((query as any).customer_id) : user.id;
    const projectId = (query as any).project_id ? Number((query as any).project_id) : undefined;
    const where: any = { deleted_at: null, customer_id: customerId };
    if (projectId) {
      where.OR = [{ crm_project_id: projectId }, { subproject_id: projectId }, { project_id: projectId }];
    }
    const tasks = await this.prisma.project_tasks.findMany({
      where,
      include: this.taskInclude,
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: tasks.map((t) => this.mapTask(t)) };
  }

  async getAssignees() {
    const users = await this.prisma.profiles.findMany({
      where: { role: { in: ['admin', 'manager', 'employee'] }, status: { not: 'inactive' } },
      select: { id: true, email: true, first_name: true, last_name: true, avatar: true, role: true, status: true },
      orderBy: { first_name: 'asc' },
    });
    return {
      success: true,
      data: users.map((u) => ({ ...u, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email })),
    };
  }

  // -------------------------------------------------------------------------
  // Project tasks
  // -------------------------------------------------------------------------
  async getProjectTasks(projectId: number, query: Record<string, unknown>, _user: UserLike) {
    const resolved = await this.resolveProjectEntity(projectId);
    if (!resolved) throw new NotFoundException('Project not found');

    const base: any = {};
    if (resolved.type === 'crm_project') base.crm_project_id = projectId;
    else if (resolved.type === 'subproject') base.subproject_id = projectId;
    else base.project_id = projectId;

    const page = Math.max(1, Number((query as any).page ?? 1));
    const limit = Math.min(100, Math.max(1, Number((query as any).limit ?? 25)));
    const where = this.buildWhere(query, base);

    const [tasks, total] = await Promise.all([
      this.prisma.project_tasks.findMany({
        where,
        include: this.taskInclude,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.project_tasks.count({ where }),
    ]);
    const stats = await this.taskStats(where);

    return {
      success: true,
      data: tasks.map((t) => this.mapTask(t)),
      stats,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit },
    };
  }

  async createProjectTask(projectId: number, body: any, user: UserLike) {
    const resolved = await this.resolveProjectEntity(projectId);
    if (!resolved) throw new NotFoundException('Project not found');

    const title = body.title?.trim();
    if (!title) throw new BadRequestException('Title is required');

    if (body.assigned_to) {
      const assignee = await this.prisma.profiles.findFirst({
        where: { id: Number(body.assigned_to), role: { in: ['admin', 'manager', 'employee'] } },
      });
      if (!assignee) throw new BadRequestException('Invalid assignee');
    }

    const taskData: any = {
      title,
      description: body.description,
      status: body.status || 'todo',
      priority: body.priority || 'medium',
      assigned_to: body.assigned_to ? Number(body.assigned_to) : null,
      estimated_hours: toNum(body.estimated_hours),
      actual_hours: toNum(body.actual_hours) ?? 0,
      due_date: body.due_date ? new Date(body.due_date) : null,
      start_date: body.start_date ? new Date(body.start_date) : null,
      parent_task_id: body.parent_task_id ? Number(body.parent_task_id) : null,
      tags: Array.isArray(body.tags) ? body.tags : body.tags ? JSON.parse(body.tags) : null,
      created_by: user.id,
      customer_visible: body.customer_visible === true || body.customer_visible === 'true',
    };

    if (resolved.type === 'crm_project') {
      taskData.crm_project_id = projectId;
      taskData.customer_id = resolved.entity.customer_id;
    } else if (resolved.type === 'subproject') {
      taskData.subproject_id = projectId;
      const parent = await this.prisma.crm_projects.findUnique({ where: { id: resolved.entity.parent_project_id } });
      taskData.customer_id = parent?.customer_id ?? null;
    } else {
      taskData.project_id = projectId;
      taskData.customer_id = resolved.entity.contact_id;
    }

    const task = await this.prisma.project_tasks.create({ data: taskData });
    const full = await this.prisma.project_tasks.findUnique({ where: { id: task.id }, include: this.taskInclude });
    return { success: true, task: this.mapTask(full) };
  }

  async getProjectActivity(projectId: number, _query: Record<string, unknown>) {
    const resolved = await this.resolveProjectEntity(projectId);
    if (!resolved) throw new NotFoundException('Project not found');

    const base: any = {};
    if (resolved.type === 'crm_project') base.crm_project_id = projectId;
    else if (resolved.type === 'subproject') base.subproject_id = projectId;
    else base.project_id = projectId;

    const [tasks, comments, microtasks, workItems] = await Promise.all([
      this.prisma.project_tasks.findMany({ where: { ...base, deleted_at: null }, orderBy: { updated_at: 'desc' }, take: 20, select: { id: true, title: true, status: true, created_at: true, updated_at: true, created_by: true } }),
      this.prisma.task_comments.findMany({ where: { project_tasks: base }, orderBy: { created_at: 'desc' }, take: 20, include: { profiles: { select: { id: true, first_name: true, last_name: true } } } }),
      this.prisma.task_microtasks.findMany({ where: { project_tasks: base, is_completed: true }, orderBy: { completed_at: 'desc' }, take: 20 }),
      this.prisma.time_entry_work_items.findMany({ where: { project_tasks: base }, orderBy: { created_at: 'desc' }, take: 20, include: { hr_time_entries: { select: { id: true, clock_in_time: true, clock_out_time: true, total_minutes: true } } } }),
    ]);

    const activity: any[] = [];
    for (const t of tasks) activity.push({ type: 'task', ...t, timestamp: t.updated_at || t.created_at });
    for (const c of comments) activity.push({ type: 'comment', id: c.id, task_id: c.task_id, content: c.content, author: c.profiles, timestamp: c.created_at });
    for (const m of microtasks) activity.push({ type: 'microtask', id: m.id, task_id: m.project_task_id, title: m.title, timestamp: m.completed_at });
    for (const w of workItems) activity.push({ type: 'work_log', id: w.id, task_id: w.task_id, description: w.description, hours: toNum(w.hours_spent), timestamp: w.created_at });

    activity.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { success: true, activity: activity.slice(0, 50) };
  }

  // -------------------------------------------------------------------------
  // Single task
  // -------------------------------------------------------------------------
  async getTask(id: number, user: UserLike) {
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null }, include: this.taskInclude });
    if (!task) throw new NotFoundException('Task not found');
    this.ensureTaskAccess(task, user);
    return { success: true, task: this.mapTask(task) };
  }

  async updateTask(id: number, body: any, user: UserLike) {
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null }, include: this.taskInclude });
    if (!task) throw new NotFoundException('Task not found');
    this.ensureTaskAccess(task, user);

    if (['admin', 'manager'].includes(user.role) === false && body.assigned_to && body.assigned_to !== user.id) {
      throw new ForbiddenException('You can only reassign to yourself');
    }

    const updates: any = {};
    const fields = ['title', 'description', 'priority', 'status', 'assigned_to', 'estimated_hours', 'actual_hours', 'due_date', 'start_date', 'parent_task_id', 'tags', 'customer_visible', 'weight', 'expected_duration_days', 'phase_id', 'customer_id'];
    for (const field of fields) {
      if (body[field] !== undefined) {
        if (field === 'title') updates.title = body.title.trim();
        else if (field === 'tags') updates.tags = Array.isArray(body.tags) ? body.tags : body.tags ? JSON.parse(body.tags) : null;
        else if (['assigned_to', 'parent_task_id', 'phase_id', 'customer_id'].includes(field)) updates[field] = body[field] ? Number(body[field]) : null;
        else if (['estimated_hours', 'actual_hours', 'weight', 'expected_duration_days'].includes(field)) updates[field] = toNum(body[field]);
        else if (['due_date', 'start_date'].includes(field)) updates[field] = body[field] ? new Date(body[field]) : null;
        else if (field === 'customer_visible') updates.customer_visible = body[field] === true || body[field] === 'true';
        else updates[field] = body[field];
      }
    }

    if (updates.status === 'completed' && !task.completed_at) {
      updates.completed_at = new Date();
      if (updates.actual_hours === undefined || updates.actual_hours === null) {
        updates.actual_hours = toNum(task.estimated_hours) ?? 0;
      }
    } else if (updates.status && updates.status !== 'completed') {
      updates.completed_at = null;
    }

    const updated = await this.prisma.project_tasks.update({ where: { id }, data: updates, include: this.taskInclude });
    return { success: true, task: this.mapTask(updated) };
  }

  async deleteTask(id: number, user: UserLike) {
    if (!['admin', 'manager'].includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null } });
    if (!task) throw new NotFoundException('Task not found');
    await this.prisma.project_tasks.update({ where: { id }, data: { deleted_at: new Date() } });
    return { success: true, message: 'Task deleted' };
  }

  async assignTask(id: number, body: any, user: UserLike) {
    if (!['admin', 'manager'].includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    const assigned_to = Number(body.assigned_to);
    if (!assigned_to) throw new BadRequestException('assigned_to is required');
    const assignee = await this.prisma.profiles.findFirst({
      where: { id: assigned_to, role: { in: ['admin', 'manager', 'employee'] } },
    });
    if (!assignee) throw new BadRequestException('Invalid assignee');
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null }, include: this.taskInclude });
    if (!task) throw new NotFoundException('Task not found');
    const updated = await this.prisma.project_tasks.update({ where: { id }, data: { assigned_to }, include: this.taskInclude });
    return { success: true, task: this.mapTask(updated) };
  }

  async updateStatus(id: number, body: any, user: UserLike) {
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null }, include: this.taskInclude });
    if (!task) throw new NotFoundException('Task not found');
    this.ensureTaskAccess(task, user);

    const updates: any = { status: body.status };
    if (body.status === 'completed') {
      updates.completed_at = new Date();
      updates.actual_hours = toNum(body.actual_hours) ?? toNum(task.estimated_hours) ?? 0;
    } else {
      updates.completed_at = null;
    }
    const updated = await this.prisma.project_tasks.update({ where: { id }, data: updates, include: this.taskInclude });
    return { success: true, data: this.mapTask(updated) };
  }

  // -------------------------------------------------------------------------
  // Time logging
  // -------------------------------------------------------------------------
  async logTime(id: number, body: any, user: UserLike) {
    const { start_time, end_time, description } = body;
    if (!start_time || !end_time) throw new BadRequestException('start_time and end_time are required');
    const start = new Date(start_time);
    const end = new Date(end_time);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const hours = parseFloat((minutes / 60).toFixed(2));

    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null } });
    if (!task) throw new NotFoundException('Task not found');
    this.ensureTaskAccess(task, user);

    const employee = await this.prisma.employees.findUnique({ where: { user_id: user.id } });
    if (!employee) throw new BadRequestException('Employee record not found');

    const entry = await this.prisma.hr_time_entries.create({
      data: {
        employee_id: employee.id,
        clock_in_time: start,
        clock_out_time: end,
        total_minutes: minutes,
        is_manual_entry: true,
        status: 'active',
        notes: description,
      },
    });
    const workItem = await this.prisma.time_entry_work_items.create({
      data: {
        time_entry_id: entry.id,
        task_id: id,
        description,
        item_type: 'task',
        hours_spent: new Decimal(hours),
      },
    });

    const actual = toNum0(task.actual_hours) + hours;
    await this.prisma.project_tasks.update({ where: { id }, data: { actual_hours: actual } });

    return { success: true, log: { ...workItem, hours: toNum(workItem.hours_spent) }, totalMinutes: minutes, totalHours: hours };
  }

  async getWorkLog(id: number, user: UserLike) {
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null } });
    if (!task) throw new NotFoundException('Task not found');
    this.ensureTaskAccess(task, user);
    const items = await this.prisma.time_entry_work_items.findMany({
      where: { task_id: id },
      include: { hr_time_entries: { select: { clock_in_time: true, clock_out_time: true, total_minutes: true } } },
      orderBy: { created_at: 'desc' },
    });
    const totalHours = items.reduce((sum, it) => sum + toNum0(it.hours_spent), 0);
    return {
      success: true,
      data: items.map((it) => ({ ...it, hours: toNum(it.hours_spent), time_entry: it.hr_time_entries })),
      totalHours,
    };
  }

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------
  async getComments(id: number, user: UserLike) {
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null } });
    if (!task) throw new NotFoundException('Task not found');
    this.ensureTaskAccess(task, user);
    const comments = await this.prisma.task_comments.findMany({
      where: { task_id: id },
      include: { profiles: { select: { id: true, first_name: true, last_name: true, avatar: true, email: true } } },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, comments };
  }

  async addComment(id: number, body: any, user: UserLike) {
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null } });
    if (!task) throw new NotFoundException('Task not found');
    this.ensureTaskAccess(task, user);
    const content = body.content?.trim();
    if (!content) throw new BadRequestException('Content is required');
    const comment = await this.prisma.task_comments.create({
      data: {
        task_id: id,
        author_id: user.id,
        content,
        is_internal: body.is_internal === true || body.is_internal === 'true',
        mentions: Array.isArray(body.mentions) ? body.mentions : body.mentions ? JSON.parse(body.mentions) : [],
        attachments: Array.isArray(body.attachments) ? body.attachments : body.attachments ? JSON.parse(body.attachments) : [],
      },
    });
    const full = await this.prisma.task_comments.findUnique({ where: { id: comment.id }, include: { profiles: { select: { id: true, first_name: true, last_name: true, avatar: true, email: true } } } });
    return { success: true, comment: full };
  }

  async deleteComment(id: number, commentId: number, user: UserLike) {
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null } });
    if (!task) throw new NotFoundException('Task not found');
    this.ensureTaskAccess(task, user);
    const comment = await this.prisma.task_comments.findUnique({ where: { id: commentId } });
    if (!comment || comment.task_id !== id) throw new NotFoundException('Comment not found');
    if (comment.author_id !== user.id && !['admin', 'manager'].includes(user.role)) throw new ForbiddenException('Cannot delete this comment');
    await this.prisma.task_comments.delete({ where: { id: commentId } });
    return { success: true, message: 'Comment deleted' };
  }

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------
  async addAttachments(id: number, files: Express.Multer.File[] | undefined, body: any, user: UserLike) {
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null } });
    if (!task) throw new NotFoundException('Task not found');
    this.ensureTaskAccess(task, user);

    const attachments = Array.isArray(task.attachments) ? [...task.attachments] : [];
    const uploaded: any[] = [];
    if (files && files.length > 0) {
      if (!this.storage || !this.storage.isConfigured()) throw new BadRequestException('Storage not configured');
      for (const file of files) {
        const result = await this.storage.upload(file.buffer, 'task-attachments', file.originalname, file.mimetype, `task-${id}`);
        if (!result.success) throw new BadRequestException(result.error);
        uploaded.push({ name: file.originalname, url: result.url, size: file.size, type: file.mimetype, uploaded_at: new Date().toISOString(), uploaded_by: user.id });
      }
    } else if (body.attachments) {
      const extra = Array.isArray(body.attachments) ? body.attachments : JSON.parse(body.attachments);
      uploaded.push(...extra);
    }

    const updated = await this.prisma.project_tasks.update({
      where: { id },
      data: { attachments: [...attachments, ...uploaded] as any },
      include: this.taskInclude,
    });
    return { success: true, attachments: updated.attachments, task: this.mapTask(updated) };
  }

  // -------------------------------------------------------------------------
  // Duplicate and additional assignees
  // -------------------------------------------------------------------------
  async duplicateTask(id: number, user: UserLike) {
    if (!['admin', 'manager'].includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    const task = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null }, include: { task_microtasks: true } });
    if (!task) throw new NotFoundException('Task not found');

    const copyData: any = {
      title: `Copy of ${task.title}`,
      description: task.description,
      status: 'todo',
      priority: task.priority,
      assigned_to: task.assigned_to,
      estimated_hours: task.estimated_hours,
      actual_hours: 0,
      due_date: task.due_date,
      start_date: task.start_date,
      crm_project_id: task.crm_project_id,
      subproject_id: task.subproject_id,
      project_id: task.project_id,
      customer_id: task.customer_id,
      phase_id: task.phase_id,
      tags: task.tags,
      customer_visible: task.customer_visible,
      created_by: user.id,
    };
    const copy = await this.prisma.project_tasks.create({ data: copyData });
    for (const mt of task.task_microtasks) {
      await this.prisma.task_microtasks.create({
        data: { project_task_id: copy.id, title: mt.title, position: mt.position, is_mandatory: mt.is_mandatory },
      });
    }
    const full = await this.prisma.project_tasks.findUnique({ where: { id: copy.id }, include: this.taskInclude });
    return { success: true, task: this.mapTask(full) };
  }

  async additionalAssignees(id: number, body: any, user: UserLike) {
    if (!['admin', 'manager'].includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    const assigneeIds = (body.assignee_ids || []).map((x: any) => Number(x)).filter((x: number) => !Number.isNaN(x));
    if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) throw new BadRequestException('assignee_ids array required');

    const source = await this.prisma.project_tasks.findUnique({ where: { id, deleted_at: null }, include: { task_microtasks: true } });
    if (!source) throw new NotFoundException('Task not found');

    const existing = await this.prisma.project_tasks.findMany({
      where: { title: source.title, crm_project_id: source.crm_project_id, subproject_id: source.subproject_id, project_id: source.project_id, due_date: source.due_date },
      select: { assigned_to: true },
    });
    const existingAssignees = new Set(existing.map((t) => t.assigned_to));
    const newIds = assigneeIds.filter((aid) => !existingAssignees.has(aid));
    if (newIds.length === 0) return { success: true, message: 'All selected people are already assigned', data: [] };

    const valid = await this.prisma.profiles.findMany({ where: { id: { in: newIds } }, select: { id: true } });
    const validIds = valid.map((p) => p.id);
    const created: any[] = [];
    for (const assigneeId of validIds) {
      const copyData: any = {
        title: source.title,
        description: source.description,
        status: source.status,
        priority: source.priority,
        assigned_to: assigneeId,
        estimated_hours: source.estimated_hours,
        actual_hours: 0,
        due_date: source.due_date,
        start_date: source.start_date,
        crm_project_id: source.crm_project_id,
        subproject_id: source.subproject_id,
        project_id: source.project_id,
        customer_id: source.customer_id,
        phase_id: source.phase_id,
        tags: source.tags,
        customer_visible: source.customer_visible,
        created_by: user.id,
      };
      const copy = await this.prisma.project_tasks.create({ data: copyData });
      for (const mt of source.task_microtasks) {
        await this.prisma.task_microtasks.create({
          data: { project_task_id: copy.id, title: mt.title, position: mt.position, is_mandatory: mt.is_mandatory },
        });
      }
      created.push(copy.id);
    }
    const tasks = await this.prisma.project_tasks.findMany({ where: { id: { in: created } }, include: this.taskInclude });
    return { success: true, message: `Task assigned to ${validIds.length} additional people`, data: tasks.map((t) => this.mapTask(t)) };
  }

  // -------------------------------------------------------------------------
  // Recurring tasks
  // -------------------------------------------------------------------------
  private calculateNextGenerationAt(frequency: string, dayOfWeek: number | null, dayOfMonth: number | null, timeOfDay: string, startDate: Date, base = new Date()): Date {
    const [h, m] = timeOfDay.split(':').map((x) => Number(x));
    const next = new Date(base);
    next.setHours(h, m, 0, 0);
    if (frequency === 'daily') {
      if (next <= base) next.setDate(next.getDate() + 1);
    } else if (frequency === 'weekly') {
      const targetDay = dayOfWeek ?? 1;
      next.setDate(next.getDate() + ((targetDay - next.getDay() + 7) % 7));
      if (next <= base) next.setDate(next.getDate() + 7);
    } else if (frequency === 'monthly') {
      next.setDate(dayOfMonth ?? 1);
      if (next <= base) next.setMonth(next.getMonth() + 1);
    }
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    if (next < start) next.setTime(start.getTime());
    return next;
  }

  private timeOfDayToString(value: Date | string | null | undefined): string {
    if (!value) return '09:00:00';
    if (typeof value === 'string') return value;
    const s = value.toISOString();
    const time = s.split('T')[1]?.split('.')[0];
    return time || '09:00:00';
  }

  async createStandaloneTask(body: any, user: UserLike) {
    const title = body.title?.trim();
    if (!title) throw new BadRequestException('Title is required');
    if (body.assigned_to) {
      const assignee = await this.prisma.profiles.findFirst({
        where: { id: Number(body.assigned_to), role: { in: ['admin', 'manager', 'employee'] } },
      });
      if (!assignee) throw new BadRequestException('Invalid assignee');
    }
    const taskData: any = {
      title,
      description: body.description,
      status: body.status || 'todo',
      priority: body.priority || 'medium',
      assigned_to: body.assigned_to ? Number(body.assigned_to) : null,
      estimated_hours: toNum(body.estimated_hours),
      actual_hours: toNum(body.actual_hours) ?? 0,
      due_date: body.due_date ? new Date(body.due_date) : null,
      start_date: body.start_date ? new Date(body.start_date) : null,
      parent_task_id: body.parent_task_id ? Number(body.parent_task_id) : null,
      tags: Array.isArray(body.tags) ? body.tags : body.tags ? JSON.parse(body.tags) : null,
      created_by: user.id,
      customer_visible: body.customer_visible === true || body.customer_visible === 'true',
    };
    if (body.crm_project_id) taskData.crm_project_id = Number(body.crm_project_id);
    if (body.subproject_id) taskData.subproject_id = Number(body.subproject_id);
    if (body.project_id) taskData.project_id = Number(body.project_id);
    if (body.customer_id) taskData.customer_id = Number(body.customer_id);
    if (body.customer_id) taskData.customer_id = Number(body.customer_id);

    const task = await this.prisma.project_tasks.create({ data: taskData });
    const full = await this.prisma.project_tasks.findUnique({ where: { id: task.id }, include: this.taskInclude });
    return { success: true, task: this.mapTask(full) };
  }

  // Recurring tasks
  async getRecurringTasks(query: Record<string, unknown>) {
    const page = Math.max(1, Number((query as any).page ?? 1));
    const limit = Math.min(100, Math.max(1, Number((query as any).limit ?? 25)));
    const where: any = { deleted_at: null };
    if ((query as any).is_active !== undefined) where.is_active = (query as any).is_active === 'true';
    const [rows, total] = await Promise.all([
      this.prisma.recurring_task_configs.findMany({
        where,
        include: {
          profiles_recurring_task_configs_created_byToprofiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
          profiles_recurring_task_configs_fixed_assignee_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
          crm_projects: { select: { id: true, name: true, project_number: true } },
          deals: { select: { id: true, title: true, deal_number: true } },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.recurring_task_configs.count({ where }),
    ]);
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const generatedCount = await this.prisma.project_tasks.count({ where: { recurring_config_id: r.id, deleted_at: null } });
        return { ...r, generated_task_count: generatedCount };
      }),
    );
    return {
      success: true,
      data: enriched,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit },
    };
  }

  async getRecurringTask(id: number) {
    const config = await this.prisma.recurring_task_configs.findUnique({
      where: { id, deleted_at: null },
      include: {
        profiles_recurring_task_configs_created_byToprofiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
        profiles_recurring_task_configs_fixed_assignee_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
        crm_projects: { select: { id: true, name: true, project_number: true } },
        deals: { select: { id: true, title: true, deal_number: true } },
        project_tasks: { where: { deleted_at: null }, take: 20, orderBy: { created_at: 'desc' } },
      },
    });
    if (!config) throw new NotFoundException('Recurring task config not found');
    let roundRobinProfiles: any[] = [];
    if (config.assignment_type === 'round_robin' && Array.isArray(config.round_robin_assignees) && (config.round_robin_assignees as any[]).length > 0) {
      roundRobinProfiles = await this.prisma.profiles.findMany({
        where: { id: { in: (config.round_robin_assignees as any[]).map((x: any) => Number(x)) } },
        select: { id: true, first_name: true, last_name: true, email: true, avatar: true },
      });
    }
    return { success: true, data: { ...config, round_robin_profiles: roundRobinProfiles } };
  }

  async createRecurringTask(body: any, user: UserLike) {
    const title = body.title?.trim();
    if (!title) throw new BadRequestException('Title is required');
    if (!body.frequency || !['daily', 'weekly', 'monthly'].includes(body.frequency)) throw new BadRequestException('Invalid frequency');
    if (!body.start_date) throw new BadRequestException('start_date is required');
    if (body.frequency === 'weekly' && body.day_of_week === undefined) throw new BadRequestException('day_of_week required');
    if (body.frequency === 'monthly' && body.day_of_month === undefined) throw new BadRequestException('day_of_month required');
    if (body.assignment_type === 'fixed' && !body.fixed_assignee_id) throw new BadRequestException('fixed_assignee_id required');
    if (body.assignment_type === 'round_robin' && (!body.round_robin_assignees || body.round_robin_assignees.length === 0)) throw new BadRequestException('round_robin_assignees required');

    const data: any = {
      title,
      description: body.description?.trim() || null,
      priority: body.priority || 'medium',
      estimated_hours: toNum(body.estimated_hours),
      project_id: body.project_id ? Number(body.project_id) : null,
      crm_project_id: body.crm_project_id ? Number(body.crm_project_id) : null,
      subproject_id: body.subproject_id ? Number(body.subproject_id) : null,
      customer_id: body.customer_id ? Number(body.customer_id) : null,
      company_id: body.company_id ? Number(body.company_id) : null,
      tags: Array.isArray(body.tags) ? body.tags : body.tags ? JSON.parse(body.tags) : [],
      frequency: body.frequency,
      day_of_week: body.day_of_week !== undefined ? Number(body.day_of_week) : null,
      day_of_month: body.day_of_month !== undefined ? Number(body.day_of_month) : null,
      time_of_day: body.time_of_day || '09:00:00',
      duration_days: Number(body.duration_days) || 1,
      assignment_type: body.assignment_type || 'fixed',
      fixed_assignee_id: body.fixed_assignee_id ? Number(body.fixed_assignee_id) : null,
      round_robin_assignees: Array.isArray(body.round_robin_assignees) ? body.round_robin_assignees.map((x: any) => Number(x)) : [],
      reminder_on_create: body.reminder_on_create !== false,
      reminder_before_deadline: body.reminder_before_deadline !== false,
      reminder_on_overdue: body.reminder_on_overdue !== false,
      is_active: true,
      start_date: new Date(body.start_date),
      end_date: body.end_date ? new Date(body.end_date) : null,
      created_by: user.id,
    };
    const nextGen = this.calculateNextGenerationAt(data.frequency, data.day_of_week, data.day_of_month, data.time_of_day, data.start_date);
    data.next_generation_at = nextGen;

    const config = await this.prisma.recurring_task_configs.create({ data });
    const full = await this.prisma.recurring_task_configs.findUnique({
      where: { id: config.id },
      include: {
        profiles_recurring_task_configs_created_byToprofiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
        profiles_recurring_task_configs_fixed_assignee_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
      },
    });
    return { success: true, message: 'Recurring task config created', data: full };
  }

  async updateRecurringTask(id: number, body: any, _user: UserLike) {
    const existing = await this.prisma.recurring_task_configs.findUnique({ where: { id, deleted_at: null } });
    if (!existing) throw new NotFoundException('Recurring task config not found');

    const updates: any = {};
    const fields = ['title', 'description', 'priority', 'estimated_hours', 'project_id', 'crm_project_id', 'subproject_id', 'customer_id', 'company_id', 'tags', 'frequency', 'day_of_week', 'day_of_month', 'time_of_day', 'duration_days', 'assignment_type', 'fixed_assignee_id', 'round_robin_assignees', 'reminder_on_create', 'reminder_before_deadline', 'reminder_on_overdue', 'is_active', 'start_date', 'end_date'];
    for (const field of fields) {
      if (body[field] === undefined) continue;
      if (['reminder_on_create', 'reminder_before_deadline', 'reminder_on_overdue', 'is_active'].includes(field)) {
        updates[field] = body[field] === true || body[field] === 'true';
      } else if (['project_id', 'crm_project_id', 'subproject_id', 'customer_id', 'company_id', 'fixed_assignee_id', 'duration_days', 'day_of_week', 'day_of_month'].includes(field)) {
        updates[field] = body[field] !== null && body[field] !== '' ? Number(body[field]) : null;
      } else if (field === 'estimated_hours') {
        updates[field] = toNum(body[field]);
      } else if (field === 'round_robin_assignees') {
        updates[field] = Array.isArray(body[field]) ? body[field].map((x: any) => Number(x)) : [];
      } else if (field === 'tags') {
        updates[field] = Array.isArray(body[field]) ? body[field] : body[field] ? JSON.parse(body[field]) : [];
      } else if (['start_date', 'end_date'].includes(field)) {
        updates[field] = body[field] ? new Date(body[field]) : null;
      } else {
        updates[field] = body[field];
      }
    }

    const config = await this.prisma.recurring_task_configs.update({ where: { id }, data: updates });
    if (updates.frequency || updates.day_of_week !== undefined || updates.day_of_month !== undefined || updates.time_of_day || updates.start_date) {
      const nextGen = this.calculateNextGenerationAt(config.frequency, config.day_of_week, config.day_of_month, this.timeOfDayToString(config.time_of_day), config.start_date, new Date());
      await this.prisma.recurring_task_configs.update({ where: { id }, data: { next_generation_at: nextGen } });
    }

    const full = await this.prisma.recurring_task_configs.findUnique({
      where: { id },
      include: {
        profiles_recurring_task_configs_created_byToprofiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
        profiles_recurring_task_configs_fixed_assignee_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
      },
    });
    return { success: true, message: 'Recurring task config updated', data: full };
  }

  async deleteRecurringTask(id: number, user: UserLike) {
    if (!['admin', 'manager'].includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    const config = await this.prisma.recurring_task_configs.findUnique({ where: { id, deleted_at: null } });
    if (!config) throw new NotFoundException('Recurring task config not found');
    await this.prisma.recurring_task_configs.update({ where: { id }, data: { deleted_at: new Date() } });
    return { success: true, message: 'Recurring task config deleted. Already-generated tasks remain.' };
  }

  async toggleRecurringTask(id: number, user: UserLike) {
    if (!['admin', 'manager'].includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    const config = await this.prisma.recurring_task_configs.findUnique({ where: { id, deleted_at: null } });
    if (!config) throw new NotFoundException('Recurring task config not found');
    const newStatus = !config.is_active;
    const updateData: any = { is_active: newStatus };
    if (newStatus) {
      updateData.next_generation_at = this.calculateNextGenerationAt(config.frequency, config.day_of_week, config.day_of_month, this.timeOfDayToString(config.time_of_day), config.start_date, new Date());
    }
    await this.prisma.recurring_task_configs.update({ where: { id }, data: updateData });
    return { success: true, message: `Recurring task config ${newStatus ? 'activated' : 'paused'}`, data: { id, is_active: newStatus } };
  }
}
