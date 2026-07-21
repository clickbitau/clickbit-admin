import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';

interface UserLike {
  id: number;
  role: string;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Decimal) return value.toNumber();
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function daysBetween(start: Date, end: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / msPerDay);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

@Injectable()
export class ProjectLifecycleService {
  constructor(private readonly prisma: PrismaService,
    private readonly cache?: CacheService) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('project-lifecycle', ...parts) ?? `project-lifecycle:` + parts.filter((p) => p !== undefined && p !== null).join(':');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }


  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------
  async getTemplates(projectType?: string) {
    return this.cached(this.cacheKey('getTemplates', projectType), async () => {

      const where: any = { is_active: true };
      if (projectType) where.project_type = projectType;
      return this.prisma.project_templates.findMany({
        where,
        include: {
          phase_templates: {
            select: { id: true, name: true, position: true, weight: true, phase_type: true, estimated_hours: true },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });


    });
}

  async getTemplate(id: number) {
    return this.cached(this.cacheKey('getTemplate', id), async () => {

      const template = await this.prisma.project_templates.findUnique({
        where: { id },
        include: {
          phase_templates: {
            orderBy: { position: 'asc' },
            include: {
              task_templates: {
                orderBy: { position: 'asc' },
                include: { microtask_templates: { orderBy: { position: 'asc' } } },
              },
            },
          },
        },
      });
      if (!template) throw new NotFoundException('Template not found');
      return template;


    });
}

  async previewTemplate(id: number, startDate: string, endDate: string) {
    return this.cached(this.cacheKey('previewTemplate', id, startDate, endDate), async () => {

      const template = await this.getTemplate(id);
      const projectStart = new Date(startDate);
      const projectEnd = new Date(endDate);
      const totalDays = Math.max(1, daysBetween(projectStart, projectEnd));
      const sortedPhases = [...(template.phase_templates || [])].sort((a: any, b: any) => a.position - b.position);

      const preview: any[] = [];
      let currentStart = new Date(projectStart);
      for (const pt of sortedPhases) {
        const weight = toNumber(pt.weight);
        const durationDays = Math.max(1, Math.round(totalDays * (weight / 100)));
        const phaseStart = new Date(currentStart);
        const phaseEnd = addDays(phaseStart, durationDays - 1);

        const tasks = ((pt as any).task_templates || [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((tt: any) => ({
            title: tt.title,
            weight: toNumber(tt.weight),
            estimatedHours: toNumber(tt.estimated_hours) || null,
            priority: tt.priority,
            microtaskCount: (tt.microtask_templates || []).length,
            microtasks: tt.microtask_templates ? tt.microtask_templates.map((mt: any) => mt.title) : [],
          }));

        preview.push({
          name: pt.name,
          position: pt.position,
          weight,
          phaseType: pt.phase_type,
          isMandatory: pt.is_mandatory,
          dependencyType: pt.dependency_type,
          durationDays,
          startDate: formatDate(phaseStart),
          endDate: formatDate(phaseEnd),
          estimatedHours: toNumber(pt.estimated_hours) || null,
          taskCount: tasks.length,
          microtaskCount: tasks.reduce((sum: number, t: any) => sum + t.microtaskCount, 0),
          tasks,
        });

        if (pt.dependency_type !== 'parallel') {
          currentStart = addDays(phaseEnd, 1);
        }
      }

      return {
        template: {
          id: template.id,
          name: template.name,
          projectType: template.project_type,
          totalEstimatedHours: toNumber(template.total_estimated_hours) || null,
        },
        timeline: { startDate, endDate, totalDays },
        phases: preview,
        totals: {
          phaseCount: preview.length,
          taskCount: preview.reduce((sum, p) => sum + p.taskCount, 0),
          microtaskCount: preview.reduce((sum, p) => sum + p.microtaskCount, 0),
        },
      };


    });
}

  async applyTemplate(targetId: number, targetType: 'project' | 'subproject', templateId: number, user?: UserLike) {
    await this.invalidateCache();

    const template = await this.getTemplate(templateId);
    let parent: any;
    let parentProjectId: number | null = null;
    let parentSubprojectId: number | null = null;
    let companyId: number | null = null;
    let customerId: number | null = null;

    if (targetType === 'subproject') {
      parent = await this.prisma.crm_subprojects.findUnique({ where: { id: targetId } });
      if (!parent) throw new NotFoundException('Subproject not found');
      parentSubprojectId = targetId;
      const project = await this.prisma.crm_projects.findUnique({ where: { id: parent.parent_project_id } });
      if (project) {
        companyId = project.company_id ?? null;
        customerId = project.customer_id ?? null;
      }
    } else {
      parent = await this.prisma.crm_projects.findUnique({ where: { id: targetId } });
      if (!parent) throw new NotFoundException('Project not found');
      parentProjectId = targetId;
      companyId = parent.company_id ?? null;
      customerId = parent.customer_id ?? null;
    }

    if (!parent.start_date || !parent.due_date) {
      throw new BadRequestException('Parent must have start_date and due_date before applying a template');
    }

    const sortedPhaseTemplates = [...(template.phase_templates || [])].sort((a: any, b: any) => a.position - b.position);

    const phaseInputs = sortedPhaseTemplates.map((pt: any) => ({
      crm_project_id: parentProjectId,
      subproject_id: parentSubprojectId,
      name: pt.name,
      description: pt.description,
      position: pt.position,
      weight: pt.weight,
      status: 'not_started',
      progress_percentage: 0,
      phase_type: pt.phase_type,
      dependency_type: pt.dependency_type || 'sequential',
      is_mandatory: pt.is_mandatory || false,
      estimated_hours: pt.estimated_hours,
      actual_hours: 0,
      template_phase_id: pt.id,
      created_by: user?.id,
    })) as any;

    const createdPhases = await this.prisma.project_phases.createManyAndReturn({ data: phaseInputs });
    const positionToPhaseId = new Map(createdPhases.map((phase: any, i: number) => [sortedPhaseTemplates[i].position, phase.id]));

    const dependencyUpdates = createdPhases
      .map((phase: any, i: number) => {
        const pt = sortedPhaseTemplates[i];
        if (pt.depends_on_position == null) return null;
        const dependsOnPhaseId = positionToPhaseId.get(pt.depends_on_position);
        return dependsOnPhaseId ? { id: phase.id, depends_on_phase_id: dependsOnPhaseId } : null;
      })
      .filter(Boolean) as { id: number; depends_on_phase_id: number }[];

    if (dependencyUpdates.length > 0) {
      await this.prisma.$transaction(
        dependencyUpdates.map((update) =>
          this.prisma.project_phases.update({ where: { id: update.id }, data: { depends_on_phase_id: update.depends_on_phase_id } }),
        ),
      );
    }

    const taskInputs: any[] = [];
    const phaseTemplateMap = new Map(createdPhases.map((phase: any, i: number) => [phase.id, sortedPhaseTemplates[i]]));
    for (const phase of createdPhases) {
      const pt: any = phaseTemplateMap.get(phase.id);
      const sortedTaskTemplates = [...(pt.task_templates || [])].sort((a: any, b: any) => a.position - b.position);
      for (const tt of sortedTaskTemplates) {
        taskInputs.push({
          phase_id: phase.id,
          crm_project_id: parentProjectId,
          subproject_id: parentSubprojectId,
          company_id: companyId,
          customer_id: customerId,
          title: tt.title,
          description: tt.description,
          status: 'todo',
          priority: tt.priority || 'medium',
          position: tt.position,
          weight: tt.weight,
          estimated_hours: tt.estimated_hours,
          is_template_generated: true,
          template_task_id: tt.id,
          assigned_to: phase.manager_id ?? null,
          actual_hours: 0,
        });
      }
    }

    const createdTasks = taskInputs.length > 0 ? await this.prisma.project_tasks.createManyAndReturn({ data: taskInputs }) : [];

    const microtaskInputs: any[] = [];
    let taskIndex = 0;
    for (const phase of createdPhases) {
      const pt: any = phaseTemplateMap.get(phase.id);
      const sortedTaskTemplates = [...(pt.task_templates || [])].sort((a: any, b: any) => a.position - b.position);
      for (const tt of sortedTaskTemplates) {
        const task = createdTasks[taskIndex++];
        const sortedMicrotaskTemplates = [...(tt.microtask_templates || [])].sort((a: any, b: any) => a.position - b.position);
        for (const mt of sortedMicrotaskTemplates) {
          microtaskInputs.push({
            project_task_id: task.id,
            title: mt.title,
            position: mt.position,
            is_mandatory: mt.is_mandatory !== false,
            is_completed: false,
            template_microtask_id: mt.id,
          });
        }
      }
    }

    if (microtaskInputs.length > 0) {
      await this.prisma.task_microtasks.createMany({ data: microtaskInputs });
    }

    await this.calculatePhaseTimeline(targetId, targetType, parent.start_date as Date, parent.due_date as Date);
    await Promise.all(createdPhases.map((phase: any) => this.calculateTaskExpectedTimes(phase.id)));

    if (targetType === 'project') {
      await this.prisma.crm_projects.update({ where: { id: targetId }, data: { project_type: template.project_type } as any });
    }

    return {
      templateName: template.name,
      projectType: template.project_type,
      phases: createdPhases.length,
      taskCount: createdTasks.length,
      microtaskCount: microtaskInputs.length,
    };
  }

  // -------------------------------------------------------------------------
  // Phases
  // -------------------------------------------------------------------------
  async getPhases(parentId: number, parentType: 'project' | 'subproject') {
    return this.cached(this.cacheKey('getPhases', parentId, parentType), async () => {

      const where: any = { deleted_at: null };
      if (parentType === 'project') where.crm_project_id = parentId;
      else where.subproject_id = parentId;

      const phases = await this.prisma.project_phases.findMany({
        where,
        include: {
          project_tasks: {
            where: { deleted_at: null },
            include: {
              task_microtasks: { orderBy: { position: 'asc' } },
              profiles_project_tasks_assigned_toToprofiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
            },
            orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
          },
          profiles_project_phases_manager_idToprofiles: { select: { id: true, first_name: true, last_name: true, avatar: true } },
        },
        orderBy: { position: 'asc' },
      });
      return phases;


    });
}

  async resetPhases(parentId: number, parentType: 'project' | 'subproject') {
    await this.invalidateCache();

    const where: any = {};
    if (parentType === 'project') where.crm_project_id = parentId;
    else where.subproject_id = parentId;

    const phases = await this.prisma.project_phases.findMany({
      where,
      include: {
        project_tasks: {
          include: { task_microtasks: true },
        },
      },
    });

    const phaseIds = phases.map((p) => p.id);
    const taskIds: number[] = [];
    for (const p of phases) {
      for (const t of (p as any).project_tasks || []) {
        taskIds.push(t.id);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (taskIds.length > 0) {
        await tx.time_entry_work_items.deleteMany({ where: { task_id: { in: taskIds } } }).catch(() => {});
        await tx.task_comments.deleteMany({ where: { task_id: { in: taskIds } } }).catch(() => {});
        await tx.task_microtasks.deleteMany({ where: { project_task_id: { in: taskIds } } });
        await tx.project_tasks.deleteMany({ where: { phase_id: { in: phaseIds } } });
      }
      await tx.phase_logs.deleteMany({ where: { project_phase_id: { in: phaseIds } } }).catch(() => {});
      await tx.project_phases.deleteMany({ where });
    });

    if (parentType === 'project') {
      await this.prisma.crm_projects.update({ where: { id: parentId }, data: { progress_percentage: 0 } });
    } else {
      await this.prisma.crm_subprojects.update({ where: { id: parentId }, data: { progress_percentage: 0 } });
    }
    return { success: true, message: 'Timeline reset successfully' };
  }

  async createPhase(parentId: number, parentType: 'project' | 'subproject', body: any, user?: UserLike) {
    await this.invalidateCache();

    const data: any = {
      name: body.name,
      description: body.description,
      position: body.position,
      weight: body.weight,
      phase_type: body.phase_type,
      dependency_type: body.dependency_type,
      depends_on_phase_id: body.depends_on_phase_id,
      is_mandatory: body.is_mandatory,
      estimated_hours: body.estimated_hours,
      manager_id: body.manager_id,
      created_by: user?.id,
      status: 'not_started',
      progress_percentage: 0,
    };
    if (parentType === 'project') data.crm_project_id = parentId;
    else data.subproject_id = parentId;

    const phase = await this.prisma.project_phases.create({ data });
    await this.logPhaseEvent(phase.id, 'created', `Phase "${phase.name}" created manually`, { weight: phase.weight, phase_type: phase.phase_type }, undefined, user?.id);

    const parent = parentType === 'project'
      ? await this.prisma.crm_projects.findUnique({ where: { id: parentId } })
      : await this.prisma.crm_subprojects.findUnique({ where: { id: parentId } });
    if (parent?.start_date && parent?.due_date) {
      await this.calculatePhaseTimeline(parentId, parentType, parent.start_date, parent.due_date);
    }

    return phase;
  }

  async updatePhase(phaseId: number, body: any, user?: UserLike) {
    await this.invalidateCache();

    const phase = await this.prisma.project_phases.findUnique({ where: { id: phaseId } });
    if (!phase) throw new NotFoundException('Phase not found');

    const oldValues = {
      name: phase.name,
      weight: phase.weight,
      status: phase.status,
      due_date: phase.due_date,
      start_date: phase.start_date,
      manager_id: phase.manager_id,
    };

    const allowed = ['name', 'description', 'position', 'weight', 'status', 'phase_type', 'dependency_type', 'depends_on_phase_id', 'is_mandatory', 'estimated_hours', 'manager_id', 'start_date', 'due_date'];
    const updates: any = {};
    for (const field of allowed) {
      if (body[field] !== undefined) {
        updates[field] = body[field] === '' ? null : body[field];
      }
    }

    const updated = await this.prisma.project_phases.update({ where: { id: phaseId }, data: updates });

    if (body.manager_id !== undefined && body.manager_id !== oldValues.manager_id) {
      await this.prisma.project_tasks.updateMany({ where: { phase_id: phaseId }, data: { assigned_to: body.manager_id || null } as any });
      await this.logPhaseEvent(phaseId, 'general_update', body.manager_id ? 'Phase assigned to employee and tasks cascaded' : 'Phase manager removed', { manager_id: body.manager_id }, { manager_id: oldValues.manager_id }, user?.id);
    }

    if (body.status && body.status !== oldValues.status) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (body.status === 'in_progress') {
        if (!updated.start_date || today < new Date(updated.start_date)) {
          await this.prisma.project_phases.update({ where: { id: phaseId }, data: { start_date: today } });
        }
        await this.logPhaseEvent(phaseId, 'started', 'Phase started', { status: 'in_progress' }, { status: oldValues.status }, user?.id);
      } else if (body.status === 'completed') {
        await this.prisma.project_phases.update({ where: { id: phaseId }, data: { completed_date: today, progress_percentage: 100 } });
        await this.logPhaseEvent(phaseId, 'completed', 'Phase completed', { status: 'completed' }, { status: oldValues.status }, user?.id);
      }

      if (updated.crm_project_id) await this.recalculateFromProject(updated.crm_project_id);
      else if (updated.subproject_id) await this.recalculateFromSubproject(updated.subproject_id);
    }

    if (body.weight !== undefined || body.due_date || body.start_date) {
      await this.calculateTaskExpectedTimes(phaseId);
    }

    return this.prisma.project_phases.findUnique({
      where: { id: phaseId },
      include: {
        project_tasks: { where: { deleted_at: null }, include: { task_microtasks: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
        profiles_project_phases_manager_idToprofiles: { select: { id: true, first_name: true, last_name: true, avatar: true } },
      },
    });
  }

  async reorderPhases(parentId: number, parentType: 'project' | 'subproject', phases: any[], _user?: UserLike) {
    await this.invalidateCache();

    if (!Array.isArray(phases)) throw new BadRequestException('phases array is required');
    for (const { id, position } of phases) {
      const phase = await this.prisma.project_phases.findUnique({ where: { id } });
      if (!phase) continue;
      await this.prisma.project_phases.update({ where: { id }, data: { position } });
    }
    const parent = parentType === 'project'
      ? await this.prisma.crm_projects.findUnique({ where: { id: parentId } })
      : await this.prisma.crm_subprojects.findUnique({ where: { id: parentId } });
    if (parent?.start_date && parent?.due_date) {
      await this.calculatePhaseTimeline(parentId, parentType, parent.start_date, parent.due_date);
    }
    return this.getPhases(parentId, parentType);
  }

  async deletePhase(phaseId: number) {
    await this.invalidateCache();

    const phase = await this.prisma.project_phases.findUnique({ where: { id: phaseId } });
    if (!phase) throw new NotFoundException('Phase not found');

    await this.prisma.project_phases.update({ where: { id: phaseId }, data: { deleted_at: new Date() } });

    if (phase.crm_project_id) {
      await this.updateProjectProgress(phase.crm_project_id);
      const project = await this.prisma.crm_projects.findUnique({ where: { id: phase.crm_project_id } });
      if (project?.start_date && project?.due_date) {
        await this.calculatePhaseTimeline(phase.crm_project_id, 'project', project.start_date, project.due_date);
      }
    } else if (phase.subproject_id) {
      await this.updateSubprojectProgress(phase.subproject_id);
      const sp = await this.prisma.crm_subprojects.findUnique({ where: { id: phase.subproject_id } });
      if (sp?.start_date && sp?.due_date) {
        await this.calculatePhaseTimeline(phase.subproject_id, 'subproject', sp.start_date, sp.due_date);
      }
    }
    return { success: true, message: 'Phase deleted' };
  }

  async getPhaseLogs(phaseId: number, limit = 50) {
    return this.cached(this.cacheKey('getPhaseLogs', phaseId, limit), async () => {

      return this.prisma.phase_logs.findMany({
        where: { project_phase_id: phaseId },
        include: { profiles: { select: { id: true, first_name: true, last_name: true, avatar: true } } },
        orderBy: { created_at: 'desc' },
        take: limit,
      });


    });
}

  // -------------------------------------------------------------------------
  // Tasks within phases
  // -------------------------------------------------------------------------
  async createTaskInPhase(phaseId: number, body: any, user?: UserLike) {
    await this.invalidateCache();

    const phase = await this.prisma.project_phases.findUnique({ where: { id: phaseId } });
    if (!phase) throw new NotFoundException('Phase not found');

    const title = body.title?.trim();
    if (!title) throw new BadRequestException('Task title is required');

    const maxPos = await this.prisma.project_tasks.aggregate({ _max: { position: true }, where: { phase_id: phaseId } });
    const position = (maxPos._max.position || 0) + 1;

    const task = await this.prisma.project_tasks.create({
      data: {
        phase_id: phase.id,
        crm_project_id: phase.crm_project_id,
        subproject_id: phase.subproject_id,
        title,
        priority: body.priority || 'medium',
        status: phase.status === 'in_progress' ? 'todo' : 'backlog',
        weight: body.weight ?? 10,
        expected_duration_days: body.expected_duration_days,
        position,
        assigned_to: phase.manager_id ?? null,
        description: body.description,
        created_by: user?.id,
        actual_hours: 0,
      } as any,
    });

    await this.calculateTaskExpectedTimes(phaseId).catch(() => {});
    if (phase.crm_project_id) await this.recalculateFromProject(phase.crm_project_id).catch(() => {});
    else if (phase.subproject_id) await this.recalculateFromSubproject(phase.subproject_id).catch(() => {});

    return task;
  }

  async deleteTaskFromPhase(phaseId: number, taskId: number) {
    await this.invalidateCache();

    const phase = await this.prisma.project_phases.findUnique({ where: { id: phaseId } });
    if (!phase) throw new NotFoundException('Phase not found');
    const task = await this.prisma.project_tasks.findFirst({ where: { id: taskId, phase_id: phaseId } });
    if (!task) throw new NotFoundException('Task not found in this phase');

    await this.prisma.$transaction(async (tx) => {
      await tx.time_entry_work_items.deleteMany({ where: { task_id: taskId } }).catch(() => {});
      await tx.task_comments.deleteMany({ where: { task_id: taskId } }).catch(() => {});
      await tx.task_microtasks.deleteMany({ where: { project_task_id: taskId } });
      await tx.project_tasks.delete({ where: { id: taskId } });
    });

    await this.updatePhaseProgress(phaseId).catch(() => {});
    if (phase.crm_project_id) {
      await this.updateProjectProgress(phase.crm_project_id).catch(() => {});
      await this.recalculateFromProject(phase.crm_project_id).catch(() => {});
    } else if (phase.subproject_id) {
      await this.updateSubprojectProgress(phase.subproject_id).catch(() => {});
      await this.recalculateFromSubproject(phase.subproject_id).catch(() => {});
    }
    return { success: true, message: 'Task deleted' };
  }

  // -------------------------------------------------------------------------
  // Microtasks
  // -------------------------------------------------------------------------
  async getMicrotasks(taskId: number) {
    return this.cached(this.cacheKey('getMicrotasks', taskId), async () => {

      const microtasks = await this.prisma.task_microtasks.findMany({
        where: { project_task_id: taskId },
        include: { profiles: { select: { id: true, first_name: true, last_name: true, avatar: true } } },
        orderBy: { position: 'asc' },
      });
      const stats = await this.getMicrotaskStats(taskId);
      return { microtasks, stats };


    });
}

  async createMicrotask(taskId: number, body: any, _user?: UserLike) {
    await this.invalidateCache();

    let position = body.position;
    if (position === undefined) {
      const maxPos = await this.prisma.task_microtasks.aggregate({ _max: { position: true }, where: { project_task_id: taskId } });
      position = (maxPos._max.position || 0) + 1;
    }
    const microtask = await this.prisma.task_microtasks.create({
      data: {
        project_task_id: taskId,
        title: body.title,
        position,
        is_mandatory: body.is_mandatory !== false,
        is_completed: false,
      },
    });
    return microtask;
  }

  async updateMicrotask(taskId: number, id: number, body: any) {
    await this.invalidateCache();

    const microtask = await this.prisma.task_microtasks.findUnique({ where: { id } });
    if (!microtask || microtask.project_task_id !== taskId) throw new NotFoundException('Microtask not found');
    const updates: any = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.position !== undefined) updates.position = body.position;
    if (body.is_mandatory !== undefined) updates.is_mandatory = body.is_mandatory;
    const updated = await this.prisma.task_microtasks.update({ where: { id }, data: updates });
    return updated;
  }

  async toggleMicrotask(taskId: number, id: number, user?: UserLike) {
    await this.invalidateCache();

    const microtask = await this.prisma.task_microtasks.findUnique({ where: { id } });
    if (!microtask || microtask.project_task_id !== taskId) throw new NotFoundException('Microtask not found');

    const isCompleted = !microtask.is_completed;
    const now = new Date();
    const updated = await this.prisma.task_microtasks.update({
      where: { id },
      data: {
        is_completed: isCompleted,
        completed_at: isCompleted ? now : null,
        completed_by: isCompleted ? user?.id : null,
      },
    });

    const stats = await this.getMicrotaskStats(taskId);
    return { microtask: updated, stats };
  }

  async deleteMicrotask(taskId: number, id: number) {
    await this.invalidateCache();

    const microtask = await this.prisma.task_microtasks.findUnique({ where: { id } });
    if (!microtask || microtask.project_task_id !== taskId) throw new NotFoundException('Microtask not found');
    await this.prisma.task_microtasks.delete({ where: { id } });
    return { success: true, message: 'Microtask deleted' };
  }

  async reorderMicrotasks(taskId: number, microtasks: any[]) {
    await this.invalidateCache();

    if (!Array.isArray(microtasks)) throw new BadRequestException('microtasks array is required');
    for (const { id, position } of microtasks) {
      const mt = await this.prisma.task_microtasks.findUnique({ where: { id } });
      if (!mt || mt.project_task_id !== taskId) continue;
      await this.prisma.task_microtasks.update({ where: { id }, data: { position } });
    }
    const updated = await this.prisma.task_microtasks.findMany({ where: { project_task_id: taskId }, orderBy: { position: 'asc' } });
    return { success: true, microtasks: updated };
  }

  async toggleAllMicrotasks(taskId: number, completed: boolean, user?: UserLike) {
    await this.invalidateCache();

    const isCompleted = completed !== false;
    const now = new Date();
    await this.prisma.task_microtasks.updateMany({
      where: { project_task_id: taskId },
      data: {
        is_completed: isCompleted,
        completed_at: isCompleted ? now : null,
        completed_by: isCompleted ? user?.id : null,
      },
    });
    const microtasks = await this.prisma.task_microtasks.findMany({ where: { project_task_id: taskId }, orderBy: { position: 'asc' } });
    const stats = await this.getMicrotaskStats(taskId);
    return { success: true, microtasks, stats };
  }

  private async getMicrotaskStats(taskId: number) {
    const all = await this.prisma.task_microtasks.findMany({ where: { project_task_id: taskId } });
    const completed = all.filter((m) => m.is_completed).length;
    const mandatory = all.filter((m) => m.is_mandatory);
    const mandatoryCompleted = mandatory.filter((m) => m.is_completed).length;
    return {
      total: all.length,
      completed,
      percentage: all.length > 0 ? Math.round((completed / all.length) * 100) : 0,
      mandatoryTotal: mandatory.length,
      mandatoryCompleted,
      allMandatoryDone: mandatory.length === 0 || mandatoryCompleted === mandatory.length,
    };
  }

  // -------------------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------------------
  async recalculateTimeline(parentId: number, parentType: 'project' | 'subproject') {
    await this.invalidateCache();

    const parent = parentType === 'project'
      ? await this.prisma.crm_projects.findUnique({ where: { id: parentId } })
      : await this.prisma.crm_subprojects.findUnique({ where: { id: parentId } });
    if (!parent?.start_date || !parent?.due_date) return { success: true, message: 'Timeline recalculated' };
    await this.recalculateFromEntity(parentId, parentType);
    return { success: true, message: 'Timeline recalculated' };
  }

  async getExpectedCompletion(entityId: number, entityType: 'project' | 'subproject' | 'phase') {
    return this.cached(this.cacheKey('getExpectedCompletion', entityId, entityType), async () => {

      let tasks: any[] = [];
      let deadlineDate: Date | null = null;

      if (entityType === 'phase') {
        const phase = await this.prisma.project_phases.findUnique({ where: { id: entityId } });
        if (!phase) throw new NotFoundException('Phase not found');
        deadlineDate = phase.due_date;
        tasks = await this.prisma.project_tasks.findMany({ where: { phase_id: entityId } });
      } else if (entityType === 'subproject') {
        const sp = await this.prisma.crm_subprojects.findUnique({ where: { id: entityId } });
        if (!sp) throw new NotFoundException('Subproject not found');
        deadlineDate = sp.due_date;
        const phases = await this.prisma.project_phases.findMany({ where: { subproject_id: entityId, deleted_at: null } });
        for (const phase of phases) {
          const pts = await this.prisma.project_tasks.findMany({ where: { phase_id: phase.id } });
          tasks.push(...pts);
        }
      } else {
        const project = await this.prisma.crm_projects.findUnique({ where: { id: entityId } });
        if (!project) throw new NotFoundException('Project not found');
        deadlineDate = project.due_date;
        const subprojects = await this.prisma.crm_subprojects.findMany({ where: { parent_project_id: entityId } });
        if (subprojects.length > 0) {
          for (const sp of subprojects) {
            const phases = await this.prisma.project_phases.findMany({ where: { subproject_id: sp.id, deleted_at: null } });
            for (const phase of phases) {
              const pts = await this.prisma.project_tasks.findMany({ where: { phase_id: phase.id } });
              tasks.push(...pts);
            }
          }
        } else {
          const phases = await this.prisma.project_phases.findMany({ where: { crm_project_id: entityId, deleted_at: null } });
          for (const phase of phases) {
            const pts = await this.prisma.project_tasks.findMany({ where: { phase_id: phase.id } });
            tasks.push(...pts);
          }
        }
      }

      if (tasks.length === 0) {
        return { expectedDate: deadlineDate, deadlineDate, status: 'no_tasks', daysVariance: 0 };
      }

      const incompleteTasks = tasks.filter((t) => t.status !== 'completed');
      let avgDailyHours = 8;
      const assigneeIds = [...new Set(incompleteTasks.map((t) => t.assigned_to).filter(Boolean))] as number[];
      if (assigneeIds.length > 0) {
        const employees = await this.prisma.employees.findMany({
          where: { user_id: { in: assigneeIds } },
          select: { id: true },
        });
        const employeeIds = employees.map((e) => e.id);
        if (employeeIds.length > 0) {
          const shifts = await this.prisma.hr_shifts.findMany({
            where: { employee_id: { in: employeeIds } },
            orderBy: { created_at: 'desc' },
          });
          const latestByEmployee = new Map<number, any>();
          for (const shift of shifts) {
            if (!latestByEmployee.has(shift.employee_id)) {
              latestByEmployee.set(shift.employee_id, shift);
            }
          }
          let totalHours = 0;
          let count = 0;
          for (const shift of latestByEmployee.values()) {
            const hours = toNumber(shift.hours_per_day) || toNumber(shift.total_hours) || 8;
            totalHours += hours;
            count++;
          }
          if (count > 0) avgDailyHours = totalHours / count;
        }
      }

      let totalEstimatedHours = 0;
      let completedHours = 0;
      let remainingHours = 0;
      for (const t of tasks) {
        const expected = toNumber(t.estimated_hours) || (toNumber(t.expected_duration_days) * avgDailyHours) || 0;
        const actual = toNumber(t.actual_hours) || 0;
        totalEstimatedHours += expected;
        if (t.status === 'completed') {
          completedHours += Math.max(actual, expected);
        } else {
          completedHours += actual;
          remainingHours += Math.max(0, expected - actual);
        }
      }

      const assigneeCount = Math.max(1, [...new Set(incompleteTasks.map((t) => t.assigned_to).filter(Boolean))].length);
      const dailyCapacity = avgDailyHours * assigneeCount;
      const remainingDays = dailyCapacity > 0 ? Math.ceil(remainingHours / dailyCapacity) : 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expectedDate = addDays(today, remainingDays);
      const deadline = deadlineDate ? new Date(deadlineDate) : null;

      let status = 'on_track';
      let daysVariance = 0;
      if (deadline) {
        daysVariance = daysBetween(expectedDate, deadline);
        if (daysVariance < 0) status = 'behind';
        else if (daysVariance > 5) status = 'ahead';
      }

      return {
        expectedDate: formatDate(expectedDate),
        deadlineDate: deadlineDate || null,
        status,
        daysVariance,
        details: {
          totalTasks: tasks.length,
          completedTasks: tasks.length - incompleteTasks.length,
          totalEstimatedHours,
          completedHours,
          remainingHours,
          avgDailyHours,
          assigneeCount,
          remainingDays,
        },
      };


    });
}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private async recalculateFromEntity(parentId: number, parentType: 'project' | 'subproject') {
    const parent = parentType === 'project'
      ? await this.prisma.crm_projects.findUnique({ where: { id: parentId } })
      : await this.prisma.crm_subprojects.findUnique({ where: { id: parentId } });
    if (!parent?.start_date || !parent?.due_date) return;
    const phases = await this.calculatePhaseTimeline(parentId, parentType, parent.start_date, parent.due_date);
    for (const phase of phases) {
      await this.calculateTaskExpectedTimes(phase.id);
    }
  }

  private async calculatePhaseTimeline(parentId: number, parentType: 'project' | 'subproject', startDate: Date, endDate: Date, persist = true) {
    const where: any = { deleted_at: null };
    if (parentType === 'project') where.crm_project_id = parentId;
    else where.subproject_id = parentId;

    const phases = await this.prisma.project_phases.findMany({ where, orderBy: { position: 'asc' } });
    if (phases.length === 0) return [];

    const projectStart = new Date(startDate);
    const projectEnd = new Date(endDate);
    const totalDays = Math.max(1, daysBetween(projectStart, projectEnd));

    for (const phase of phases) {
      (phase as any)._durationDays = Math.max(1, Math.round(totalDays * (toNumber(phase.weight) / 100)));
    }

    const phaseById = new Map(phases.map((p) => [p.id, p]));

    for (const phase of phases) {
      if (!phase.depends_on_phase_id) {
        (phase as any)._calcStart = new Date(projectStart);
      } else {
        const predecessor = phaseById.get(phase.depends_on_phase_id);
        if (!predecessor) {
          (phase as any)._calcStart = new Date(projectStart);
        } else {
          if (phase.dependency_type === 'parallel') {
            (phase as any)._calcStart = new Date((predecessor as any)._calcStart || projectStart);
          } else {
            const predEnd = (predecessor as any)._calcEnd || (predecessor as any)._calcStart;
            (phase as any)._calcStart = predEnd ? addDays(new Date(predEnd), 1) : new Date(projectStart);
          }
        }
      }
      (phase as any)._calcEnd = addDays((phase as any)._calcStart, (phase as any)._durationDays - 1);
      if ((phase as any)._calcEnd > projectEnd) (phase as any)._calcEnd = new Date(projectEnd);
    }

    if (persist) {
      await Promise.all(
        phases.map((phase) =>
          this.prisma.project_phases.update({
            where: { id: phase.id },
            data: { start_date: (phase as any)._calcStart, due_date: (phase as any)._calcEnd } as any,
          }),
        ),
      );
    }

    return phases.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      weight: toNumber(p.weight),
      durationDays: (p as any)._durationDays,
      start_date: formatDate((p as any)._calcStart),
      due_date: formatDate((p as any)._calcEnd),
      dependency_type: p.dependency_type,
      depends_on_phase_id: p.depends_on_phase_id,
    }));
  }

  private async calculateTaskExpectedTimes(phaseId: number, persist = true) {
    const phase = await this.prisma.project_phases.findUnique({ where: { id: phaseId } });
    if (!phase || !phase.start_date || !phase.due_date) return [];
    const phaseStart = phase.start_date;
    const phaseDue = phase.due_date;
    const phaseDays = Math.max(1, daysBetween(new Date(phaseStart), new Date(phaseDue)));
    const tasks = await this.prisma.project_tasks.findMany({ where: { phase_id: phaseId, deleted_at: null }, orderBy: { position: 'asc' } });
    if (tasks.length === 0) return [];

    const totalWeight = tasks.reduce((sum, t) => sum + (toNumber(t.weight) || 0), 0);
    const useEqualWeights = totalWeight === 0;

    const taskUpdates = tasks.map((task) => {
      const weight = useEqualWeights ? 100 / tasks.length : toNumber(task.weight) || 0;
      const expectedDays = Math.max(0.5, (phaseDays * weight) / 100);
      if (persist) {
        let due = addDays(new Date(phaseStart), Math.ceil(expectedDays) - 1);
        if (due > new Date(phaseDue)) due = new Date(phaseDue);
        return this.prisma.project_tasks.update({
          where: { id: task.id },
          data: {
            expected_duration_days: Math.round(expectedDays * 10) / 10,
            start_date: phaseStart,
            due_date: due,
          } as any,
        });
      }
      return Promise.resolve();
    });

    if (persist) {
      await Promise.all(taskUpdates);
    }
    return tasks;
  }

  private async recalculateFromProject(projectId: number) {
    const project = await this.prisma.crm_projects.findUnique({ where: { id: projectId } });
    if (!project?.start_date || !project?.due_date) return;
    const subprojects = await this.prisma.crm_subprojects.findMany({ where: { parent_project_id: projectId } });
    if (subprojects.length > 0) {
      for (const sp of subprojects) {
        if (sp.start_date && sp.due_date) await this.recalculateFromEntity(sp.id, 'subproject');
      }
    } else {
      await this.recalculateFromEntity(projectId, 'project');
    }
  }

  private async recalculateFromSubproject(subprojectId: number) {
    const sp = await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } });
    if (!sp?.start_date || !sp?.due_date) return;
    await this.recalculateFromEntity(subprojectId, 'subproject');
  }

  private async logPhaseEvent(phaseId: number, eventType: string, description: string, newValue?: any, oldValue?: any, userId?: number) {
    try {
      await this.prisma.phase_logs.create({
        data: {
          project_phase_id: phaseId,
          event_type: eventType,
          description,
          old_value: oldValue,
          new_value: newValue,
          created_by: userId,
        },
      });
    } catch {
      // ignore
    }
  }

  // -------------------------------------------------------------------------
  // Progress rollup
  // -------------------------------------------------------------------------
  private async updateTaskProgress(taskId: number) {
    const task = await this.prisma.project_tasks.findUnique({ where: { id: taskId }, include: { task_microtasks: true } });
    if (!task) return;
    const all = task.task_microtasks || [];
    if (all.length === 0) return;
    const completed = all.filter((m) => m.is_completed).length;
    const percentage = Math.round((completed / all.length) * 100);
    if (percentage > 0 && percentage < 100 && task.status === 'todo') {
      await this.prisma.project_tasks.update({ where: { id: taskId }, data: { status: 'in_progress', start_date: task.start_date || new Date() } as any });
    }
  }

  private async updatePhaseProgress(phaseId: number) {
    const phase = await this.prisma.project_phases.findUnique({ where: { id: phaseId } });
    if (!phase) return;
    const tasks = await this.prisma.project_tasks.findMany({ where: { phase_id: phaseId, deleted_at: null }, include: { task_microtasks: true } });
    if (tasks.length === 0) return;

    let weightedSum = 0;
    let totalWeight = 0;
    let totalActualHours = 0;
    const statusMap: Record<string, number> = { todo: 0, in_progress: 50, review: 75, completed: 100, blocked: 0 };
    for (const task of tasks) {
      const taskWeight = toNumber(task.weight) || (100 / tasks.length);
      let progress = 0;
      if (task.task_microtasks && task.task_microtasks.length > 0) {
        const completed = task.task_microtasks.filter((m) => m.is_completed).length;
        progress = Math.round((completed / task.task_microtasks.length) * 100);
      } else {
        progress = statusMap[task.status] || 0;
      }
      weightedSum += progress * taskWeight;
      totalWeight += taskWeight;
      totalActualHours += toNumber(task.actual_hours);
    }

    const newProgress = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const updateData: any = { progress_percentage: newProgress, actual_hours: totalActualHours };
    if (newProgress === 100 && phase.status !== 'completed') {
      updateData.status = 'completed';
      updateData.completed_date = new Date();
    } else if (newProgress > 0 && phase.status === 'not_started') {
      updateData.status = 'in_progress';
      updateData.start_date = new Date();
    }
    await this.prisma.project_phases.update({ where: { id: phaseId }, data: updateData });

    if (phase.crm_project_id) await this.updateProjectProgress(phase.crm_project_id);
    else if (phase.subproject_id) await this.updateSubprojectProgress(phase.subproject_id);
  }

  private async updateSubprojectProgress(subprojectId: number) {
    const sp = await this.prisma.crm_subprojects.findUnique({ where: { id: subprojectId } });
    if (!sp) return;
    const phases = await this.prisma.project_phases.findMany({ where: { subproject_id: subprojectId, deleted_at: null } });
    if (phases.length === 0) return;

    let weightedSum = 0;
    let totalWeight = 0;
    for (const phase of phases) {
      const weight = toNumber(phase.weight) || (100 / phases.length);
      weightedSum += (phase.progress_percentage || 0) * weight;
      totalWeight += weight;
    }
    const newProgress = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const updateData: any = { progress_percentage: newProgress };
    if (newProgress === 100 && sp.status !== 'completed') {
      updateData.status = 'completed';
      updateData.completed_date = new Date();
    } else if (newProgress > 0 && sp.status === 'not_started') {
      updateData.status = 'in_progress';
      updateData.start_date = new Date();
    }
    await this.prisma.crm_subprojects.update({ where: { id: subprojectId }, data: updateData });
  }

  private async updateProjectProgress(projectId: number) {
    const project = await this.prisma.crm_projects.findUnique({ where: { id: projectId } });
    if (!project) return;
    const subprojects = await this.prisma.crm_subprojects.findMany({ where: { parent_project_id: projectId } });
    let newProgress = 0;
    if (subprojects.length > 0) {
      const total = subprojects.reduce((sum, sp) => sum + (sp.progress_percentage || 0), 0);
      newProgress = Math.round(total / subprojects.length);
    } else {
      const phases = await this.prisma.project_phases.findMany({ where: { crm_project_id: projectId, deleted_at: null } });
      if (phases.length === 0) return;
      let weightedSum = 0;
      let totalWeight = 0;
      for (const phase of phases) {
        const weight = toNumber(phase.weight) || (100 / phases.length);
        weightedSum += (phase.progress_percentage || 0) * weight;
        totalWeight += weight;
      }
      newProgress = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    }
    const updateData: any = { progress_percentage: newProgress };
    if (newProgress === 100 && project.status !== 'completed') {
      updateData.status = 'completed';
      updateData.completed_date = new Date();
    } else if (newProgress > 0 && project.status === 'not_started') {
      updateData.status = 'in_progress';
      updateData.start_date = new Date();
    }
    await this.prisma.crm_projects.update({ where: { id: projectId }, data: updateData });
  }
}
