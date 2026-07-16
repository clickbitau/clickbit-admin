import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UsersService } from './users.service';
import { ProfileService } from './profile.service';
import { AuditLogsService } from './audit-logs.service';
import { SettingsController } from './settings.controller';
import { UsersController } from './users.controller';
import { ProfileController } from './profile.controller';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  controllers: [SettingsController, UsersController, ProfileController, AuditLogsController],
  providers: [SettingsService, UsersService, ProfileService, AuditLogsService],
})
export class SettingsModule {}
