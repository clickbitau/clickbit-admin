import { Module } from '@nestjs/common';
import { HrContractsController } from './hr-contracts.controller';
import { HrContractsService } from './hr-contracts.service';
import { SettingsModule } from '../settings/settings.module';
import { EmailService } from '../common/email.service';

@Module({
  imports: [SettingsModule],
  controllers: [HrContractsController],
  providers: [HrContractsService, EmailService],
})
export class HrContractsModule {}
