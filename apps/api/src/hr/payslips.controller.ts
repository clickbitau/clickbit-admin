import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { PayslipsService } from './payslips.service';
import {
  ListPayslipsQueryDto,
  CalculateSingleDto,
  PreviewBackfillDto,
  BulkCreateDto,
  UpdatePayslipStatusDto,
  DeletePayslipDto,
} from './payslips.dto';

@Controller('hr/payslips')
@UseGuards(SupabaseAuthGuard)
export class PayslipsController {
  constructor(private readonly payslipsService: PayslipsService) {}

  @Get('my')
  async findMy(@Req() req: RequestWithUser) {
    return this.payslipsService.findMyPayslips(req.user);
  }

  @Get('my/:id/pdf')
  async findMyPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.payslipsService.generatePdf(id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async findAll(@Query() query: ListPayslipsQueryDto, @Req() req: RequestWithUser) {
    return this.payslipsService.findPayslips(query as unknown as Record<string, unknown>, req.user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.payslipsService.findOne(id, req.user);
  }

  @Post('calculate-single')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async calculateSingle(@Body() dto: CalculateSingleDto, @Req() req: RequestWithUser) {
    return this.payslipsService.calculateSingle(dto as unknown as Record<string, unknown>, req.user);
  }

  @Post('next-pay-run')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async nextPayRun(@Req() req: RequestWithUser) {
    return this.payslipsService.nextPayRun(req.user);
  }

  @Post('preview-backfill')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async previewBackfill(@Body() dto: PreviewBackfillDto, @Req() req: RequestWithUser) {
    return this.payslipsService.previewBackfill(dto as unknown as Record<string, unknown>, req.user);
  }

  @Post('bulk-create')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async bulkCreate(@Body() dto: BulkCreateDto, @Req() req: RequestWithUser) {
    return this.payslipsService.bulkCreate(dto as unknown as Record<string, unknown>, req.user);
  }

  @Get(':id/pdf')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.payslipsService.generatePdf(id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async remove(@Param('id', ParseIntPipe) id: number, @Body() dto: DeletePayslipDto) {
    return this.payslipsService.remove(id, dto as unknown as Record<string, unknown>);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePayslipStatusDto,
  ) {
    return this.payslipsService.updateStatus(id, dto as unknown as Record<string, unknown>);
  }

  @Post(':id/resend-email')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async resendEmail(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.payslipsService.resendEmail(id, req.user);
  }
}
