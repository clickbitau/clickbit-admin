import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShiftNotificationSchedulerService {
  private readonly logger = new Logger(ShiftNotificationSchedulerService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('*/15 * * * *')
  async notifyUpcomingShifts(): Promise<number> {
    if (!this.enabled) return 0;
    try {
      const now = new Date();
      const soon = new Date(now.getTime() + 15 * 60 * 1000);
      const shifts = await this.prisma.hr_shifts.findMany({
        where: { start_datetime: { gte: now, lte: soon }, status: { not: 'cancelled' } },
        include: { employees_hr_shifts_employee_idToemployees: { include: { profiles: { select: { id: true, first_name: true, last_name: true } } } } },
      });
      let notified = 0;
      for (const shift of shifts) {
        const userId = shift.employees_hr_shifts_employee_idToemployees?.profiles?.id;
        if (userId) {
          await this.prisma.notifications.create({
            data: {
              user_id: userId,
              title: 'Upcoming shift',
              message: `Your shift starts at ${shift.start_datetime?.toISOString()}`,
              type: 'info',
              source: 'shift_notification',
              status: 'pending',
              metadata: JSON.stringify({ shift_id: shift.id }),
            },
          });
          notified++;
        }
      }
      if (notified) this.logger.log(`Sent ${notified} shift notification(s)`);
      return notified;
    } catch (e: any) {
      this.logger.error('Shift notification scheduler failed', e?.message);
      return 0;
    }
  }
}
