import { Module } from '@nestjs/common';
import { TicketsAdvancedController } from './tickets-advanced.controller';
import { TicketsController } from './tickets.controller';
import { TicketAutomationController } from './ticket-automation.controller';
import { TicketsAdvancedService } from './tickets-advanced.service';
import { TicketsService } from './tickets.service';
import { TicketAutomationService } from './ticket-automation.service';

@Module({
  controllers: [TicketsAdvancedController, TicketsController, TicketAutomationController],
  providers: [TicketsAdvancedService, TicketsService, TicketAutomationService],
})
export class SupportModule {}
