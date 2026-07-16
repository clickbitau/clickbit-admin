# Background workers parity

## Implemented

All legacy worker schedulers now run as NestJS `@Cron` / `@Interval` jobs inside `apps/api/src/workers/`, gated by `RUN_SCHEDULERS=true`:

- `blogScheduler` — publishes `blog_posts` where `status='scheduled'` and `scheduled_at <= now` every minute.
- `analyticsAlerts` — hourly traffic/conversion/bounce-rate checks against the `analytics` table.
- `reminderScheduler` — every minute creates `notifications` for due `hr_reminders` with `send_email=true` and `email_sent=false`.
- `recurringTaskScheduler` — every 5 minutes generates `project_tasks` from `recurring_task_configs` (fixed / round-robin assignee, daily/weekly/monthly frequency).
- `announcementAutomationService` — every minute publishes `hr_announcements` with `publish_at <= now` and `status='draft'`.
- `shiftNotificationScheduler` — every 15 minutes notifies employees of upcoming shifts.
- `attendanceMonitorService` — every 15 minutes creates missed clock-in `notifications` for started shifts without `hr_time_entries`.
- `sessionSyncService` — hourly cleanup of expired `sessions` rows.
- `taskReminderService` — every 15 minutes deadline-approaching notifications for `project_tasks`.
- `payrollAutomationService` — daily placeholder (payslip generation deferred to gap-filling).
- `mailSyncWorker` — every 5 minutes placeholder (IMAP/SMTP sync deferred to gap-filling).

## Controller

`GET /api/workers/status` and `POST /api/workers/run` are protected with `SupabaseAuthGuard` + `@Roles('admin','manager')`.

## Deferred / known gaps

- Email/SMTP delivery: workers create `notifications` rows but do not send actual email.
- IMAP/SMTP mail sync (`mailSyncWorker`) is a placeholder pending `imapflow` integration.
- Payroll/payslip calculation is a placeholder pending full time-entry → payslip logic.
- Advanced reminder deduplication, claim/revert email dispatch, and `Notification` metadata exact-match queries may need refinement.
