import { Module } from '@nestjs/common';
import { HrContractsController } from './hr-contracts.controller';
import { HrContractsService } from './hr-contracts.service';

@Module({
  controllers: [HrContractsController],
  providers: [HrContractsService],
})
export class HrContractsModule {}
