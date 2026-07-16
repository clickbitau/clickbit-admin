import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketAutomationController } from './ticket-automation.controller';
import { TicketsService } from './tickets.service';
import { TicketAutomationService } from './ticket-automation.service';

@Module({
  controllers: [TicketsController, TicketAutomationController],
  providers: [TicketsService, TicketAutomationService],
})
export class SupportModule {}
