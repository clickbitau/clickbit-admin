import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TicketAutomationService } from './ticket-automation.service';
import { CustomerRepositoryDto, UpdateCustomerRepositoryDto, QuotaDto } from './dto/support.dto';

@Controller('ticket-automation')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class TicketAutomationController {
  constructor(private readonly ticketAutomationService: TicketAutomationService) {}

  @Get('repos')
  getRepos() {
    return this.ticketAutomationService.getRepos();
  }

  @Get('customers')
  getCustomers() {
    return this.ticketAutomationService.getCustomers();
  }

  @Get('customer-repositories')
  getCustomerRepositories() {
    return this.ticketAutomationService.getCustomerRepositories();
  }

  @Post('customer-repositories')
  createCustomerRepository(@Body() dto: CustomerRepositoryDto) {
    return this.ticketAutomationService.createCustomerRepository(dto as unknown as Record<string, unknown>);
  }

  @Put('customer-repositories/:id')
  updateCustomerRepository(@Param('id') id: string, @Body() dto: UpdateCustomerRepositoryDto) {
    return this.ticketAutomationService.updateCustomerRepository(Number(id), dto as unknown as Record<string, unknown>);
  }

  @Delete('customer-repositories/:id')
  deleteCustomerRepository(@Param('id') id: string) {
    return this.ticketAutomationService.deleteCustomerRepository(Number(id));
  }

  @Get('quotas')
  getQuotas() {
    return this.ticketAutomationService.getQuotas();
  }

  @Get('quotas/:profileId')
  getQuota(@Param('profileId') profileId: string) {
    return this.ticketAutomationService.getQuota(Number(profileId));
  }

  @Put('quotas/:profileId')
  updateQuota(@Param('profileId') profileId: string, @Body() dto: QuotaDto) {
    return this.ticketAutomationService.updateQuota(Number(profileId), dto as unknown as Record<string, unknown>);
  }

  @Get('manual-review')
  getManualReview() {
    return this.ticketAutomationService.getManualReview();
  }

  @Get('purchases')
  getPurchases() {
    return this.ticketAutomationService.getPurchases();
  }
}