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
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CompaniesService } from './companies.service';
import { GetCompaniesQueryDto } from '@clickbit/shared';
import { CreateCompanyDto, UpdateCompanyDto, CompanyDocumentUploadDto } from './dto';
import { setNoCache } from './crm-utils';
import { RequestWithUser } from '../types/request-with-user';
import { Req } from '@nestjs/common';

@Controller('crm/companies')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async findAll(
    @Query() query: GetCompaniesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.findAll(query);
  }

  @Post()
  async create(
    @Body() dto: CreateCompanyDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const company = await this.companiesService.create(req.user.id, dto);
    res.status(201);
    return company;
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.delete(id);
  }

  @Get(':id/users')
  async findUsers(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.findUsers(id);
  }

  @Get(':id/invoices')
  async findInvoices(
    @Param('id', ParseIntPipe) id: number,
    @Query('status') status: string,
    @Query('type') type: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.findInvoices(
      id,
      status,
      type,
      Number(page || 1),
      Number(limit || 20),
    );
  }

  @Get(':id/payments')
  async findPayments(
    @Param('id', ParseIntPipe) id: number,
    @Query('status') status: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.findPayments(
      id,
      status,
      Number(page || 1),
      Number(limit || 20),
    );
  }

  @Get(':id/value-breakdown')
  async getValueBreakdown(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.getValueBreakdown(id);
  }

  @Get(':id/contacts')
  async findContacts(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.findContacts(id);
  }

  @Get(':id/deals')
  async findDeals(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.findDeals(id);
  }

  @Get(':id/documents')
  async getDocuments(
    @Param('id', ParseIntPipe) id: number,
    @Query('category') category: string,
    @Query('status') status: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.getDocuments(
      id,
      category,
      status,
      Number(page || 1),
      Number(limit || 50),
    );
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('document'))
  async uploadDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CompanyDocumentUploadDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.uploadDocument(req.user.id, id, file, dto);
  }

  @Get(':companyId/documents/:docId')
  async getDocument(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('docId', ParseIntPipe) docId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.getDocument(companyId, docId);
  }

  @Put(':companyId/documents/:docId')
  async updateDocument(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('docId', ParseIntPipe) docId: number,
    @Body() dto: CompanyDocumentUploadDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.updateDocument(companyId, docId, dto);
  }

  @Delete(':companyId/documents/:docId')
  async deleteDocument(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('docId', ParseIntPipe) docId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.companiesService.deleteDocument(companyId, docId);
  }
}
