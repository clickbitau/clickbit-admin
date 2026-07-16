import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('* * * * *')
  async checkReminders(): Promise<number> {
    if (!this.enabled) return 0;
    try {
      const now = new Date();
      const reminders = await this.prisma.hr_reminders.findMany({
        where: { reminder_date: { lte: now }, send_email: true, email_sent: false, status: { not: 'complete' } },
      });
      const profileIds = reminders.map((r) => r.assigned_to).filter((id): id is number => !!id);
      const profiles = await this.prisma.profiles.findMany({ where: { id: { in: profileIds } }, select: { id: true, email: true } });
      const emailById = new Map(profiles.map((p) => [p.id, p.email]));
      let processed = 0;
      for (const reminder of reminders) {
        const email = reminder.assigned_to ? emailById.get(reminder.assigned_to) : null;
        if (email && reminder.assigned_to) {
          await this.prisma.notifications.create({
            data: {
              user_id: reminder.assigned_to,
              title: `Reminder: ${reminder.title}`,
              message: reminder.description || `Your reminder "${reminder.title}" is due now.`,
              type: 'info',
              source: 'hr_reminder',
              status: 'pending',
              metadata: JSON.stringify({ reminder_id: reminder.id, trigger_type: reminder.trigger_type }),
            },
          });
        }
        await this.prisma.hr_reminders.update({
          where: { id: reminder.id },
          data: { email_sent: true, email_sent_at: now, updated_at: now },
        });
        processed++;
      }
      if (processed) this.logger.log(`Processed ${processed} reminder(s)`);
      return processed;
    } catch (e: any) {
      this.logger.error('Reminder scheduler failed', e?.message);
      return 0;
    }
  }
}
