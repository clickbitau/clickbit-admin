import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CrmModule } from './crm/crm.module';
import { FinanceModule } from './finance/finance.module';
import { HrModule } from './hr/hr.module';
import { SupportModule } from './support/support.module';
import { CommunicationModule } from './communication/communication.module';
import { ContentModule } from './content/content.module';
import { SettingsModule } from './settings/settings.module';
import { WorkersModule } from './workers/workers.module';
import { StorageModule } from './storage/storage.module';
import { UploadModule } from './upload/upload.module';
import { DocumentsModule } from './documents/documents.module';
import { DepartmentsModule } from './departments/departments.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AuthModule,
    CrmModule,
    FinanceModule,
    HrModule,
    SupportModule,
    CommunicationModule,
    ContentModule,
    SettingsModule,
    WorkersModule,
    StorageModule,
    UploadModule,
    DocumentsModule,
    DepartmentsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
