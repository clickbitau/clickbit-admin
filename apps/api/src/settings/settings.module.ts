import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { SettingsService } from './settings.service';
import { UsersService } from './users.service';
import { ProfileService } from './profile.service';
import { AuditLogsService } from './audit-logs.service';
import { PdfTemplatesService } from './pdf-templates.service';
import { SettingsController } from './settings.controller';
import { UsersController } from './users.controller';
import { ProfileController } from './profile.controller';
import { AuditLogsController } from './audit-logs.controller';
import { PdfTemplatesController } from './pdf-templates.controller';

@Module({
  imports: [StorageModule],
  controllers: [SettingsController, UsersController, ProfileController, AuditLogsController, PdfTemplatesController],
  providers: [SettingsService, UsersService, ProfileService, AuditLogsService, PdfTemplatesService],
  exports: [PdfTemplatesService],
})
export class SettingsModule {}
