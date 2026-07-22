import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { HrController } from './hr.controller';
import { EmployeesController } from './employees.controller';
import { TimeOffController } from './time-off.controller';
import { AnnouncementsController } from './announcements.controller';
import { RemindersController } from './reminders.controller';
import { PublicHolidaysController } from './public-holidays.controller';
import { PayslipsController } from './payslips.controller';
import { KpiController } from './kpi.controller';
import { TimeClockController } from './time-clock.controller';
import { TimesheetsController } from './timesheets.controller';
import { ShiftsController } from './shifts.controller';
import { EmployeesService } from './employees.service';
import { TimeOffService } from './time-off.service';
import { AnnouncementsService } from './announcements.service';
import { RemindersService } from './reminders.service';
import { PublicHolidaysService } from './public-holidays.service';
import { PayslipsService } from './payslips.service';
import { KpiService } from './kpi.service';
import { TimeClockService } from './time-clock.service';
import { TimesheetsService } from './timesheets.service';
import { ShiftsService } from './shifts.service';
import { SettingsModule } from '../settings/settings.module';
import { EmailService } from '../common/email.service';

@Module({
  imports: [AuthModule, StorageModule, SettingsModule],
  controllers: [
    HrController,
    EmployeesController,
    TimeOffController,
    AnnouncementsController,
    RemindersController,
    PublicHolidaysController,
    PayslipsController,
    KpiController,
    TimeClockController,
    TimesheetsController,
    ShiftsController,
  ],
  providers: [EmployeesService, TimeOffService, AnnouncementsService, RemindersService, PublicHolidaysService, PayslipsService, KpiService, TimeClockService, TimesheetsService, ShiftsService, EmailService],
})
export class HrModule {}
