import { Module } from '@nestjs/common';
import { TicketAutomationController } from './ticket-automation.controller';
import { TicketAutomationService } from './ticket-automation.service';

@Module({
  controllers: [TicketAutomationController],
  providers: [TicketAutomationService],
})
export class TicketAutomationModule {}
