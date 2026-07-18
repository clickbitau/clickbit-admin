import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, GetPaymentsQueryDto, PaymentDateRangeDto } from './dto/payments.dto';
import { setNoCache } from './finance-utils';

@Controller('payments')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles('admin', 'manager')
  async findAll(@Query() query: GetPaymentsQueryDto, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.paymentsService.findAll(query as unknown as Record<string, unknown>));
  }

  @Get('stats')
  @Roles('admin', 'manager')
  async getStats(@Query() query: PaymentDateRangeDto, @Res() res: Response) {
    setNoCache(res);
    const data = await this.paymentsService.getStats(query);
    return res.json({ success: true, data });
  }

  @Get(':id')
  @Roles('admin', 'manager')
  async findOne(@Param('id') id: string, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.paymentsService.findOne(id));
  }

  @Post()
  @Roles('admin', 'manager')
  async create(@Body() dto: CreatePaymentDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    const result = await this.paymentsService.create(req.user, dto as unknown as Record<string, unknown>);
    return res.status(HttpStatus.CREATED).json(result);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.paymentsService.remove(req.user, id));
  }
}
