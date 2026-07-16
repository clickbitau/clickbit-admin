import { Body, Controller, Get, Header, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PublicInvoicesService } from './public-invoices.service';

@Controller('invoices')
export class PublicInvoicesController {
  constructor(private readonly publicInvoicesService: PublicInvoicesService) {}

  @Get('pay/:code')
  async getPublicInvoice(@Param('code') code: string, @Query('token') token: string) {
    return this.publicInvoicesService.getPublicInvoice(code, token);
  }

  @Get('pay/:code/pdf')
  @Header('Content-Type', 'application/pdf')
  async getPublicInvoicePdf(@Param('code') code: string, @Query('token') token: string, @Res() res: Response) {
    const { buffer, filename } = await this.publicInvoicesService.getPublicInvoicePdf(code, token);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Post('pay/:code/checkout')
  async createCheckoutSession(@Param('code') code: string, @Body() body: any, @Query('token') token: string) {
    return this.publicInvoicesService.createCheckoutSession(code, body, token);
  }

  @Get('pay/:code/success')
  async confirmPayment(@Param('code') code: string, @Query('session_id') sessionId: string, @Query('token') token: string) {
    if (!sessionId) throw new NotFoundException('Missing session ID');
    return this.publicInvoicesService.confirmPayment(code, sessionId, token);
  }
}
