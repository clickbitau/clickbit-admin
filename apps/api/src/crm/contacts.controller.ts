import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  Res,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ContactsService } from './contacts.service';
import {
  GetContactsQueryDto,
  CreateContactDto,
  UpdateContactDto,
  UpdateLeadScoreDto,
  UpdateLifecycleStageDto,
  LinkContactCompanyDto,
  ConvertToDealDto,
  PortalAccessBatchDto,
} from './dto';
import { setNoCache } from './crm-utils';
import { RequestWithUser } from '../types/request-with-user';

@Controller('crm/contacts')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async findAll(
    @Query() query: GetContactsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.findAll(query);
  }

  @Post()
  async create(
    @Body() dto: CreateContactDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const contact = await this.contactsService.create(dto);
    res.status(201);
    return contact;
  }

  @Get('with-portal-status')
  async getWithPortalStatus(
    @Query() query: { search?: string; has_portal_access?: string; lifecycle_stage?: string; status?: string; page?: string; limit?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.getWithPortalStatus({
      ...query,
      page: Number(query.page || 1),
      limit: Number(query.limit || 50),
    });
  }

  @Get('stats')
  async getStats(
    @Query('owner_id') ownerId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.getStats(ownerId ? Number(ownerId) : undefined);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContactDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.delete(id);
  }

  @Get(':id/invoices')
  async getInvoices(
    @Param('id', ParseIntPipe) id: number,
    @Query('status') status: string,
    @Query('type') type: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.getInvoices(
      id,
      status,
      type,
      Number(page || 1),
      Number(limit || 20),
    );
  }

  @Get(':id/payments')
  async getPayments(
    @Param('id', ParseIntPipe) id: number,
    @Query('status') status: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.getPayments(
      id,
      status,
      Number(page || 1),
      Number(limit || 20),
    );
  }

  @Get(':id/projects')
  async getProjects(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.getProjects(id, Number(page || 1), Number(limit || 20));
  }

  @Get(':id/deals')
  async getDeals(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.getDeals(id, Number(page || 1), Number(limit || 20));
  }

  @Get(':id/tickets')
  async getTickets(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.getTickets(id, Number(page || 1), Number(limit || 20));
  }

  @Get(':id/portal-access')
  async getPortalAccess(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.getPortalAccess(id);
  }

  @Post(':id/portal-access')
  async createPortalAccess(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.createPortalAccess(id);
  }

  @Post(':id/resend')
  @Post(':id/portal-access/resend')
  async resendPortalEmail(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.resendPortalEmail(id);
  }

  @Post(':id/companies')
  async addCompany(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkContactCompanyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    res.status(201);
    return this.contactsService.linkCompany(id, dto.company_id, dto);
  }

  @Post('portal-access/batch')
  async batchPortalAccess(
    @Body() dto: PortalAccessBatchDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.batchPortalAccess(dto);
  }

  @Put(':id/lead-score')
  async updateLeadScore(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeadScoreDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.updateLeadScore(id, dto);
  }

  @Put(':id/lifecycle-stage')
  async updateLifecycleStage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLifecycleStageDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.updateLifecycleStage(id, dto);
  }

  @Post(':id/convert-to-deal')
  async convertToDeal(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConvertToDealDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.convertToDeal(id, dto, req.user.id);
  }

  @Post(':contactId/companies/:companyId')
  async linkCompany(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: LinkContactCompanyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    res.status(201);
    return this.contactsService.linkCompany(contactId, companyId, dto);
  }

  @Delete(':contactId/companies/:companyId')
  async unlinkCompany(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.contactsService.unlinkCompany(contactId, companyId);
  }
}
