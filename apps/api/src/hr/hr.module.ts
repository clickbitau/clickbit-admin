import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HrController } from './hr.controller';
import { EmployeesController } from './employees.controller';
import { TimeOffController } from './time-off.controller';
import { AnnouncementsController } from './announcements.controller';
import { RemindersController } from './reminders.controller';
import { PublicHolidaysController } from './public-holidays.controller';
import { EmployeesService } from './employees.service';
import { TimeOffService } from './time-off.service';
import { AnnouncementsService } from './announcements.service';
import { RemindersService } from './reminders.service';
import { PublicHolidaysService } from './public-holidays.service';

@Module({
  imports: [AuthModule],
  controllers: [
    HrController,
    EmployeesController,
    TimeOffController,
    AnnouncementsController,
    RemindersController,
    PublicHolidaysController,
  ],
  providers: [EmployeesService, TimeOffService, AnnouncementsService, RemindersService, PublicHolidaysService],
})
export class HrModule {}
