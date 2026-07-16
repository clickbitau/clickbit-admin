import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { asJson } from '../settings/settings-utils';

@Injectable()
export class RecurringTaskSchedulerService {
  private readonly logger = new Logger(RecurringTaskSchedulerService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('*/5 * * * *')
  async processConfigs(): Promise<number> {
    if (!this.enabled) return 0;
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const configs = await this.prisma.recurring_task_configs.findMany({
        where: {
          is_active: true,
          deleted_at: null,
          start_date: { lte: new Date(todayStr) },
          OR: [{ end_date: null }, { end_date: { gte: new Date(todayStr) } }],
          AND: [{ OR: [{ next_generation_at: null }, { next_generation_at: { lte: now } }] }],
        },
        orderBy: { next_generation_at: 'asc' },
      });
      let generated = 0;
      for (const config of configs) {
        try {
          await this.generateTaskFromConfig(config);
          generated++;
        } catch (e: any) {
          this.logger.error(`Failed to generate task for config ${config.id}`, e?.message);
        }
      }
      if (generated) this.logger.log(`Generated ${generated} recurring task(s)`);
      return generated;
    } catch (e: any) {
      this.logger.error('Recurring task scheduler failed', e?.message);
      return 0;
    }
  }

  private async generateTaskFromConfig(config: any): Promise<void> {
    const now = new Date();
    const assigneeId = await this.getNextAssignee(config);
    const dueDate = this.calculateDeadline(config, now);
    const title = this.formatTaskTitle(config, now);

    const task = await this.prisma.project_tasks.create({
      data: {
        title,
        description: config.description || null,
        status: 'todo',
        priority: config.priority || 'medium',
        assigned_to: assigneeId,
        estimated_hours: config.estimated_hours ? Number(config.estimated_hours) : null,
        due_date: new Date(dueDate),
        project_id: config.project_id || null,
        crm_project_id: config.crm_project_id || null,
        subproject_id: config.subproject_id || null,
        customer_id: config.customer_id || null,
        tags: config.tags || [],
        recurring_config_id: config.id,
        created_by: config.created_by || null,
        created_at: now,
        updated_at: now,
      },
    });

    if (config.assignment_type === 'round_robin') {
      await this.advanceRoundRobin(config);
    }

    const nextGenAt = this.calculateNextGenerationAt(config, now);
    await this.prisma.recurring_task_configs.update({
      where: { id: config.id },
      data: { last_generated_at: now, next_generation_at: nextGenAt, updated_at: now },
    });

    if (config.reminder_on_create && assigneeId) {
      try {
        const frequencyMap: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
        const frequencyLabel = frequencyMap[config.frequency] || '';
        await this.prisma.notifications.create({
          data: {
            user_id: assigneeId,
            title: `${frequencyLabel} recurring task assigned`,
            message: `"${title}" has been assigned to you. Due: ${dueDate}`,
            type: 'info',
            source: 'recurring_task',
            metadata: JSON.stringify({ task_id: task.id, recurring_config_id: config.id, reminder_type: 'task_created' }),
          },
        });
      } catch (e: any) {
        this.logger.warn(`Could not send creation notification for task ${task.id}`, e?.message);
      }
    }
  }

  private async getNextAssignee(config: any): Promise<number | null> {
    if (config.assignment_type === 'fixed') return config.fixed_assignee_id;
    const assignees: number[] = asJson(config.round_robin_assignees, []);
    if (!assignees.length) return null;
    let currentIndex = (config.round_robin_index || 0) % assignees.length;
    for (let attempts = 0; attempts < assignees.length; attempts++) {
      const candidateId = assignees[currentIndex];
      const employee = await this.prisma.employees.findFirst({ where: { user_id: candidateId }, select: { id: true } });
      if (employee) {
        const today = new Date().toISOString().split('T')[0];
        const onLeave = await this.prisma.hr_time_off_requests.findFirst({
          where: { employee_id: employee.id, status: 'approved', start_date: { lte: new Date(today) }, end_date: { gte: new Date(today) } },
        });
        if (!onLeave) return candidateId;
      } else {
        return candidateId;
      }
      currentIndex = (currentIndex + 1) % assignees.length;
    }
    return assignees[(config.round_robin_index || 0) % assignees.length];
  }

  private async advanceRoundRobin(config: any): Promise<void> {
    if (config.assignment_type !== 'round_robin') return;
    const assignees: number[] = asJson(config.round_robin_assignees, []);
    if (!assignees.length) return;
    const nextIndex = ((config.round_robin_index || 0) + 1) % assignees.length;
    await this.prisma.recurring_task_configs.update({ where: { id: config.id }, data: { round_robin_index: nextIndex } });
  }

  private calculateDeadline(config: any, generationDate: Date): string {
    const due = new Date(generationDate);
    due.setDate(due.getDate() + (config.duration_days || 0));
    return due.toISOString().split('T')[0];
  }

  private calculateNextGenerationAt(config: any, fromDate: Date): Date {
    const time = config.time_of_day ? new Date(config.time_of_day) : new Date('1970-01-01T09:00:00');
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const next = new Date(fromDate);
    switch (config.frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(hours, minutes, 0, 0);
        break;
      case 'weekly': {
        const targetDay = config.day_of_week ?? 1;
        let daysUntil = targetDay - next.getDay();
        if (daysUntil <= 0) daysUntil += 7;
        next.setDate(next.getDate() + daysUntil);
        next.setHours(hours, minutes, 0, 0);
        break;
      }
      case 'monthly': {
        const targetDom = config.day_of_month ?? 1;
        next.setMonth(next.getMonth() + 1);
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(targetDom, maxDay));
        next.setHours(hours, minutes, 0, 0);
        break;
      }
    }
    return next;
  }

  private formatTaskTitle(config: any, generationDate: Date): string {
    const dateStr = generationDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${config.title} — ${dateStr}`;
  }
}
