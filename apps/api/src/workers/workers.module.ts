import { Module } from '@nestjs/common';
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
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  controllers: [WorkersController],
  providers: [
    WorkersService,
    BlogSchedulerService,
    AnalyticsAlertsService,
    ReminderSchedulerService,
    RecurringTaskSchedulerService,
    AnnouncementSchedulerService,
    ShiftNotificationSchedulerService,
    AttendanceMonitorService,
    PayrollAutomationService,
    MailSyncWorkerService,
    SessionSyncService,
    TaskReminderService,
  ],
  exports: [
    BlogSchedulerService,
    AnalyticsAlertsService,
    ReminderSchedulerService,
    RecurringTaskSchedulerService,
    AnnouncementSchedulerService,
    ShiftNotificationSchedulerService,
    AttendanceMonitorService,
    PayrollAutomationService,
    MailSyncWorkerService,
    SessionSyncService,
    TaskReminderService,
  ],
})
export class WorkersModule {}
