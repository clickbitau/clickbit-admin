import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('*/15 * * * *')
  async checkDeadlineReminders(): Promise<number> {
    if (!this.enabled) return 0;
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const windows = [
        { hours: 2, label: '2 hours' },
        { hours: 24, label: '1 day' },
        { hours: 72, label: '3 days' },
      ];
      let sent = 0;
      for (const window of windows) {
        const windowEnd = new Date(now.getTime() + window.hours * 60 * 60 * 1000);
        const tasks = await this.prisma.project_tasks.findMany({
          where: {
            due_date: { gt: new Date(todayStr), lte: new Date(windowEnd.toISOString().split('T')[0]) },
            status: { not: 'completed' },
            assigned_to: { not: null },
          },
          include: { recurring_task_configs: { select: { reminder_before_deadline: true } } },
        });
        for (const task of tasks) {
          if (task.recurring_task_configs?.reminder_before_deadline === false) continue;
          const existing = await this.prisma.notifications.count({
            where: { user_id: task.assigned_to, source: 'task_reminder', metadata: { contains: `"task_id":${task.id}` } },
          });
          if (existing) continue;
          await this.prisma.notifications.create({
            data: {
              user_id: task.assigned_to,
              title: 'Deadline approaching',
              message: `Task "${task.title}" is due on ${task.due_date?.toISOString().split('T')[0]}. Please complete it soon.`,
              type: 'warning',
              source: 'task_reminder',
              status: 'pending',
              metadata: JSON.stringify({ task_id: task.id, reminder_type: 'deadline_approaching', window: window.label }),
            },
          });
          sent++;
        }
      }
      if (sent) this.logger.log(`Sent ${sent} deadline reminder(s)`);
      return sent;
    } catch (e: any) {
      this.logger.error('Task reminder scheduler failed', e?.message);
      return 0;
    }
  }
}
