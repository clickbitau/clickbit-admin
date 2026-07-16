import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { PortalsService } from './portals.service';
import { AgentController, CustomerController } from './portals.controller';

@Module({
  imports: [AuthModule, FinanceModule],
  controllers: [AgentController, CustomerController],
  providers: [PortalsService],
})
export class PortalsModule {}
