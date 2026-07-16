import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { TicketAutomationService } from './ticket-automation.service';
import { CreateCustomerRepositoryDto, UpdateCustomerRepositoryDto, UpdateQuotaDto } from './dto/ticket-automation.dto';

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
  findRepositories() {
    return this.ticketAutomationService.findRepositories();
  }

  @Post('customer-repositories')
  createRepository(@Req() req: RequestWithUser, @Body() dto: CreateCustomerRepositoryDto) {
    return this.ticketAutomationService.createRepository(req.user.id, dto);
  }

  @Put('customer-repositories/:id')
  updateRepository(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerRepositoryDto) {
    return this.ticketAutomationService.updateRepository(id, dto);
  }

  @Delete('customer-repositories/:id')
  removeRepository(@Param('id', ParseIntPipe) id: number) {
    return this.ticketAutomationService.removeRepository(id);
  }

  @Get('quotas')
  findQuotas() {
    return this.ticketAutomationService.findQuotas();
  }

  @Get('quotas/:profileId')
  getQuota(@Param('profileId', ParseIntPipe) profileId: number) {
    return this.ticketAutomationService.getQuota(profileId);
  }

  @Put('quotas/:profileId')
  updateQuota(@Req() req: RequestWithUser, @Param('profileId', ParseIntPipe) profileId: number, @Body() dto: UpdateQuotaDto) {
    return this.ticketAutomationService.updateQuota(req.user.id, profileId, dto);
  }

  @Get('manual-review')
  findManualReview() {
    return this.ticketAutomationService.findManualReview();
  }

  @Get('purchases')
  findPurchases() {
    return this.ticketAutomationService.findPurchases();
  }
}
