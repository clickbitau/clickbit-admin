import { Controller, Get, Patch, Param, Query, Body, ParseIntPipe, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { setNoCache } from './crm-utils';

@Controller()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class TasksController {
  constructor(private prisma: PrismaService) {}

  @Get('tasks')
  async findAll(
    @Query() query: { page?: string; limit?: string; search?: string; status?: string; assigned_to?: string; crm_project_id?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 25);
    const where: { [key: string]: unknown } = { deleted_at: null };

    if (query.status) where.status = query.status;
    if (query.assigned_to) where.assigned_to = Number(query.assigned_to);
    if (query.crm_project_id) where.crm_project_id = Number(query.crm_project_id);
    if (query.search) {
      (where as { OR: unknown[] }).OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

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

    return {
      data: tasks.map((t) => this.mapTask(t)),
      stats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }

  @Patch('projects/tasks/:id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string; actual_hours?: number | string },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const data: { [key: string]: unknown } = { status: body.status };
    if (body.actual_hours !== undefined) data.actual_hours = Number(body.actual_hours) || 0;
    if (body.status === 'completed') data.completed_at = new Date();

    const task = await this.prisma.project_tasks.update({
      where: { id },
      data,
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
    });

    return { data: this.mapTask(task) };
  }

  @Get('projects/tasks/assignees')
  async assignees(@Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    const users = await this.prisma.profiles.findMany({
      where: { role: { in: ['admin', 'manager', 'employee'] } },
      select: { id: true, email: true, first_name: true, last_name: true, avatar: true, role: true, status: true },
      orderBy: { first_name: 'asc' },
    });

    return {
      success: true,
      data: users.map((u) => ({
        ...u,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        avatar: u.avatar,
      })),
    };
  }

  private async taskStats(where: { [key: string]: unknown }) {
    const counts = await this.prisma.project_tasks.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });
    const total = await this.prisma.project_tasks.count({ where });
    const hours = await this.prisma.project_tasks.aggregate({
      where,
      _sum: { estimated_hours: true, actual_hours: true },
    });

    const byStatus = Object.fromEntries(counts.map((c) => [c.status, Number(c._count.status)]));
    return {
      total,
      todo: byStatus['todo'] || 0,
      in_progress: byStatus['in_progress'] || 0,
      review: byStatus['review'] || 0,
      completed: byStatus['completed'] || 0,
      blocked: byStatus['blocked'] || 0,
      totalEstimatedHours: Number(hours._sum.estimated_hours || 0),
      totalActualHours: Number(hours._sum.actual_hours || 0),
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
}
