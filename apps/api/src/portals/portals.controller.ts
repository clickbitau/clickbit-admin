import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  Res,
  Header,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { RequestWithUser } from '../types/request-with-user';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PortalsService } from './portals.service';
import { setNoCache } from '../finance/finance-utils';

@Controller('agent')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class AgentController {
  constructor(private readonly service: PortalsService) {}

  @Get('dashboard')
  @Roles('agent', 'admin')
  async dashboard(@Req() req: RequestWithUser) {
    return this.service.agentDashboard(req.user);
  }

  @Get('clients')
  @Roles('agent', 'admin')
  async clients(@Req() req: RequestWithUser) {
    return this.service.agentClients(req.user);
  }

  @Get('invoices')
  @Roles('agent', 'admin')
  async invoices(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.agentInvoices(req.user, query);
  }

  @Get('projects')
  @Roles('agent', 'admin')
  async projects(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.agentProjects(req.user, query);
  }

  @Get('projects/:id')
  @Roles('agent', 'admin')
  async projectDetail(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.agentProjectDetail(req.user, id);
  }

  @Get('companies')
  @Roles('agent', 'admin')
  async companies(@Req() req: RequestWithUser) {
    return this.service.agentCompanies(req.user);
  }

  @Put('companies/:companyId/contact/:contactId')
  @Roles('agent', 'admin')
  async assignContact(
    @Req() req: RequestWithUser,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('contactId', ParseIntPipe) contactId: number,
  ) {
    return this.service.agentAssignContactToCompany(req.user, companyId, contactId);
  }

  @Post('companies/:companyId/users')
  @Roles('agent', 'admin')
  createCompanyUser(
    @Req() req: RequestWithUser,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() body: any,
  ) {
    return this.service.agentCreateCompanyUser(req.user, companyId, body);
  }

  @Get('tickets')
  @Roles('agent', 'admin')
  async tickets(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.agentTickets(req.user, query);
  }

  @Post('tickets')
  @Roles('agent', 'admin')
  async createTicket(@Req() req: RequestWithUser, @Body() body: any) {
    return this.service.agentCreateTicket(req.user, body);
  }

  @Get('tickets/quota')
  @Roles('agent', 'admin')
  async ticketQuota(@Req() req: RequestWithUser) {
    return this.service.agentTicketQuota(req.user);
  }

  @Get('tickets/:id')
  @Roles('agent', 'admin')
  async ticketDetail(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.agentTicketDetail(req.user, id);
  }

  @Post('tickets/:id/reply')
  @Roles('agent', 'admin')
  async ticketReply(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.agentTicketReply(req.user, id, body);
  }
}

@Controller('customer')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly service: PortalsService) {}

  @Get('dashboard')
  @Roles('customer', 'admin')
  async dashboard(@Req() req: RequestWithUser) {
    return this.service.customerDashboard(req.user);
  }

  @Get('company')
  @Roles('customer', 'admin')
  async company(@Req() req: RequestWithUser) {
    return this.service.customerCompany(req.user);
  }

  @Get('orders')
  @Roles('customer', 'admin')
  async orders(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.customerOrders(req.user, query);
  }

  @Get('orders/:id')
  @Roles('customer', 'admin')
  async orderDetail(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.customerOrderDetail(req.user, id);
  }

  @Get('invoices')
  @Roles('customer', 'admin')
  async invoices(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.customerInvoices(req.user, query);
  }

  @Get('invoices/:id')
  @Roles('customer', 'admin')
  async invoiceDetail(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.customerInvoiceDetail(req.user, id);
  }

  @Get('projects')
  @Roles('customer', 'admin')
  async projects(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.customerProjects(req.user, query);
  }

  @Get('payments')
  @Roles('customer', 'admin')
  async payments(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.customerPayments(req.user, query);
  }

  @Get('submissions')
  @Roles('customer', 'admin')
  submissions(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.customerSubmissions(req.user, query);
  }

  @Get('invoices/:id/pdf')
  @Roles('customer', 'admin')
  @Header('Content-Type', 'application/pdf')
  async invoicePdf(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    setNoCache(res);
    const { buffer, filename } = await this.service.customerInvoicePdf(req.user, id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send(buffer);
  }

  @Post('invoices/:id/pay')
  @Roles('customer', 'admin')
  async payInvoice(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.customerPayInvoice(req.user, id, body);
  }

  @Post('invoices/:id/verify-payment')
  @Roles('customer', 'admin')
  async verifyPayment(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.customerVerifyPayment(req.user, id, body);
  }

  @Get('documents')
  @Roles('customer', 'admin')
  async documents(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.customerDocuments(req.user, query);
  }

  @Get('documents/:id')
  @Roles('customer', 'admin')
  async documentDetail(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.customerDocumentDetail(req.user, id);
  }

  @Post('documents/:id/download')
  @Roles('customer', 'admin')
  async documentDownload(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.customerDocumentDownload(req.user, id);
  }

  @Get('tasks')
  @Roles('customer', 'admin')
  async tasks(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.customerTasks(req.user, query);
  }

  @Get('tasks/:id')
  @Roles('customer', 'admin')
  async taskDetail(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.customerTaskDetail(req.user, id);
  }

  @Post('tasks/:id/comments')
  @Roles('customer', 'admin')
  async addTaskComment(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.customerAddTaskComment(req.user, id, body);
  }
}
