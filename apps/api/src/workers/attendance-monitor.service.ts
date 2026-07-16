import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceMonitorService {
  private readonly logger = new Logger(AttendanceMonitorService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('*/15 * * * *')
  async monitorAttendance(): Promise<void> {
    if (!this.enabled) return;
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const startedShifts = await this.prisma.hr_shifts.findMany({
        where: { shift_date: new Date(today), start_datetime: { lte: now }, status: { in: ['scheduled', 'confirmed'] } },
        include: { employees_hr_shifts_employee_idToemployees: true },
      });
      for (const shift of startedShifts) {
        const entry = await this.prisma.hr_time_entries.findFirst({ where: { shift_id: shift.id } });
        if (!entry && shift.employees_hr_shifts_employee_idToemployees?.user_id) {
          await this.prisma.notifications.create({
            data: {
              user_id: shift.employees_hr_shifts_employee_idToemployees.user_id,
              title: 'Missed clock-in',
              message: `You have not clocked in for your shift starting at ${shift.start_datetime?.toISOString()}`,
              type: 'warning',
              source: 'attendance_monitor',
              status: 'pending',
              metadata: JSON.stringify({ shift_id: shift.id }),
            },
          });
          this.logger.warn(`Missed clock-in for shift ${shift.id}`);
        }
      }
    } catch (e: any) {
      this.logger.error('Attendance monitor failed', e?.message);
    }
  }
}
