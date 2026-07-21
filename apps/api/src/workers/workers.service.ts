import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BlogSchedulerService } from './blog-scheduler.service';
import { AnalyticsAlertsService } from './analytics-alerts.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { RecurringTaskSchedulerService } from './recurring-task-scheduler.service';
import { AnnouncementSchedulerService } from './announcement-scheduler.service';
import { ShiftNotificationSchedulerService } from './shift-notification-scheduler.service';
import { AttendanceMonitorService } from './attendance-monitor.service';
import { PayrollAutomationService } from './payroll-automation.service';
import { MailSyncWorkerService } from './mail-sync-worker.service';
import { SessionSyncService } from './session-sync.service';
import { TaskReminderService } from './task-reminder.service';
import { CacheService } from '../redis/cache.service';

@Injectable()
export class WorkersService {
  private readonly logger = new Logger(WorkersService.name);

  constructor(private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly blog: BlogSchedulerService,
    private readonly analytics: AnalyticsAlertsService,
    private readonly reminders: ReminderSchedulerService,
    private readonly recurring: RecurringTaskSchedulerService,
    private readonly announcements: AnnouncementSchedulerService,
    private readonly shifts: ShiftNotificationSchedulerService,
    private readonly attendance: AttendanceMonitorService,
    private readonly payroll: PayrollAutomationService,
    private readonly mail: MailSyncWorkerService,
    private readonly sessions: SessionSyncService,
    private readonly taskReminders: TaskReminderService,
    private readonly cache?: CacheService) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('workers', ...parts) ?? `workers:` + parts.filter((p) => p !== undefined && p !== null).join(':');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }


  async getStatus() {
    return this.cached(this.cacheKey('getStatus'), async () => {

      const enabled = this.config.get<string>('RUN_SCHEDULERS') === 'true';
      return { enabled, cronJobs: Object.keys(this.schedulerRegistry.getCronJobs()) };


    });
}

  async runAll(): Promise<Record<string, unknown>> {
    await this.invalidateCache();

    return {
      blog: await this.blog.publishScheduledPosts(),
      reminders: await this.reminders.checkReminders(),
      recurring: await this.recurring.processConfigs(),
      announcements: await this.announcements.publishScheduledAnnouncements(),
      shifts: await this.shifts.notifyUpcomingShifts(),
      attendance: await this.attendance.monitorAttendance().then(() => 'ok'),
      payroll: Promise.resolve(this.payroll.processPayroll()).then(() => 'ok'),
      mail: Promise.resolve(this.mail.syncAllActiveAccounts()).then(() => 'ok'),
      sessions: await this.sessions.cleanupExpiredSessions().then(() => 'ok'),
      taskReminders: await this.taskReminders.checkDeadlineReminders(),
      analytics: await this.analytics.runAllAlerts(),
    };
  }
}
