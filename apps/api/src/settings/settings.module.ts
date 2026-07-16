import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { SettingsService } from './settings.service';
import { UsersService } from './users.service';
import { ProfileService } from './profile.service';
import { AdminService } from './admin.service';
import { AuditLogsService } from './audit-logs.service';
import { SettingsController } from './settings.controller';
import { UsersController } from './users.controller';
import { ProfileController } from './profile.controller';
import { AdminController } from './admin.controller';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  imports: [ContentModule],
  controllers: [SettingsController, UsersController, ProfileController, AdminController, AuditLogsController],
  providers: [SettingsService, UsersService, ProfileService, AdminService, AuditLogsService],
})
export class SettingsModule {}
