import { Body, Controller, Delete, Get, Header, HttpStatus, Param, ParseIntPipe, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { InvoicesService } from './invoices.service';
import { PublicInvoicesService } from './public-invoices.service';
import { CreateInvoiceDto, GetInvoicesQueryDto, RecordPaymentDto, UpdateInvoiceDto } from './dto/invoices.dto';
import { setNoCache } from './finance-utils';

@Controller('invoices')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly publicInvoicesService: PublicInvoicesService,
  ) {}

  @Get('stats')
  @Roles('admin', 'manager')
  async getStats(@Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.getStats());
  }

  @Get()
  @Roles('admin', 'manager')
  async findAll(@Query() query: GetInvoicesQueryDto, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.findAll(query as unknown as Record<string, unknown>));
  }

  @Post()
  @Roles('admin', 'manager')
  async create(@Body() dto: CreateInvoiceDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    const result = await this.invoicesService.create(req.user.id, dto as unknown as Record<string, unknown>);
    return res.status(HttpStatus.CREATED).json(result);
  }

  @Get(':id')
  @Roles('admin', 'manager')
  async findOne(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.findOne(id));
  }

  @Get(':id/pdf')
  @Roles('admin', 'manager')
  @Header('Content-Type', 'application/pdf')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    setNoCache(res);
    const { buffer, filename } = await this.publicInvoicesService.generatePdf(id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInvoiceDto, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.update(id, dto as unknown as Record<string, unknown>));
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.remove(id));
  }

  @Post(':id/void')
  @Roles('admin', 'manager')
  async void(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.void(id, req.user.email));
  }

  @Post(':id/send')
  @Roles('admin', 'manager')
  async send(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.send(id, req.get('origin'), req.user.email));
  }

  @Post(':id/mark-paid')
  @Roles('admin', 'manager')
  async markPaid(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.markPaid(id, req.user.id));
  }

  @Post(':id/record-payment')
  @Roles('admin', 'manager')
  async recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordPaymentDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.invoicesService.recordPayment(id, req.user.id, dto as unknown as Record<string, unknown>));
  }

  @Post(':id/recalculate-payments')
  @Roles('admin', 'manager')
  async recalculatePayments(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.recalculatePayments(id));
  }

  @Post('recalculate-all-payments')
  @Roles('admin')
  async recalculateAllPayments(@Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.recalculateAllPayments());
  }

  @Post('from-contact/:contactId')
  @Roles('admin', 'manager')
  async createFromContact(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.status(HttpStatus.CREATED).json(await this.invoicesService.createFromContact(req.user.id, contactId));
  }

  @Post(':id/recover-stripe-payment')
  @Roles('admin')
  async recoverStripePayment(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.recoverStripePayment(id));
  }

  @Post('recover-stripe-by-client')
  @Roles('admin')
  async recoverStripeByClient(@Body() body: any, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.invoicesService.recoverStripeByClient(body || {}));
  }
}
