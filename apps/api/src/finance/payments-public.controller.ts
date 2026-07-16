import { Body, Controller, Get, Headers, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { PublicPaymentsService } from './payments-public.service';

@Controller('payments')
export class PublicPaymentsController {
  constructor(private readonly publicPaymentsService: PublicPaymentsService) {}

  @Get('status')
  status() {
    return this.publicPaymentsService.getStatus();
  }

  @Post('create-payment-intent')
  async createPaymentIntent(@Body() body: any) {
    return this.publicPaymentsService.createPaymentIntent(body);
  }

  @Post('create-checkout-session')
  async createCheckoutSession(@Body() body: any, @Req() req: Request) {
    return this.publicPaymentsService.createCheckoutSession(body, req.ip);
  }

  @Post('confirm-payment')
  async confirmPayment(@Body() body: any) {
    return this.publicPaymentsService.confirmPayment(body);
  }

  @Get('order/:sessionId')
  async getOrderBySession(@Param() params: any) {
    return this.publicPaymentsService.getOrderBySession(params.sessionId);
  }

  @Get('order/id/:orderId')
  async getOrderById(@Param() params: any) {
    return this.publicPaymentsService.getOrderById(parseInt(params.orderId, 10));
  }

  @Post('webhook/stripe')
  async stripeWebhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('stripe-signature') signature: string, @Res() res: Response) {
    const payload = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const result = await this.publicPaymentsService.handleStripeWebhook(payload, signature);
    return res.status(200).json(result);
  }
}
