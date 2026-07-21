import { Module } from '@nestjs/common';
import { HrContractsController } from './hr-contracts.controller';
import { HrContractsService } from './hr-contracts.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [HrContractsController],
  providers: [HrContractsService],
})
export class HrContractsModule {}
