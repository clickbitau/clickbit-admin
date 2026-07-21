import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { Decimal } from '@prisma/client/runtime/library';
import { CacheService } from '../redis/cache.service';

const GST_RATE = 0.10;
const SURCHARGE_RATE = 0.02;

function toNum(value: any): number {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

@Injectable()
export class PublicPaymentsService {
  private stripe: Stripe | null = null;

  constructor(private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService) {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secret) {
      this.stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' as any });
    }
  }

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('public-payments', ...parts) ?? `public-payments:` + parts.filter((p) => p !== undefined && p !== null).join(':');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }


  getStatus() {
    return { stripe: { configured: !!this.stripe, status: this.stripe ? 'ready' : 'not configured' } };
  }

  private async validateItems(items: any[]) {
    if (!Array.isArray(items)) return [];
    const out: any[] = [];
    for (const item of items) {
      const productId = item.productId ? Number(item.productId) : null;
      let price = toNum(item.price);
      let name = item.name || 'Item';
      if (productId) {
        const product = await this.prisma.products.findUnique({ where: { id: productId } });
        if (!product || product.deleted_at) throw new BadRequestException(`Product not found: ${productId}`);
        price = Number(product.price);
        name = product.name;
      }
      out.push({ ...item, productId, price, name, quantity: Number(item.quantity) || 1 });
    }
    return out;
  }

  private calculateTotals(items: any[], paymentType = 'full') {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const gst = subtotal * GST_RATE;
    const totalBeforeSurcharge = subtotal + gst;
    let paymentAmount = totalBeforeSurcharge;
    if (paymentType === 'half') paymentAmount = totalBeforeSurcharge / 2;
    const surchargeAmount = paymentAmount * SURCHARGE_RATE;
    const totalWithSurcharge = paymentAmount + surchargeAmount;
    return { subtotal, gst, totalBeforeSurcharge, paymentAmount, surchargeAmount, totalWithSurcharge };
  }

  async createPaymentIntent(body: any) {
    await this.invalidateCache();

    if (!this.stripe) throw new BadRequestException('Stripe is not configured');
    const { amount, currency = 'aud', items, customerInfo } = body || {};
    if (!amount && !items) throw new BadRequestException('Missing required payment information');
    const validated = await this.validateItems(items || []);
    const totals = this.calculateTotals(validated, body.payment_type);
    const finalAmount = amount ? toNum(amount) : totals.totalWithSurcharge;
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(finalAmount * 100),
      currency: (currency as string).toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        items: JSON.stringify(validated),
        customerEmail: customerInfo?.email || '',
        customerName: customerInfo?.name || '',
        subtotal: totals.subtotal.toString(),
        gst: totals.gst.toString(),
        total: finalAmount.toString(),
      },
    });
    return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };
  }

  async createCheckoutSession(body: any, ip?: string) {
    await this.invalidateCache();

    if (!this.stripe) throw new BadRequestException('Stripe is not configured');
    const { currency = 'aud', items, customerInfo, payment_type = 'full', success_url, cancel_url } = body || {};
    if (!items || !customerInfo) throw new BadRequestException('Missing required payment information');
    const validated = await this.validateItems(items);
    const totals = this.calculateTotals(validated, payment_type);
    const address = {
      name: customerInfo.name,
      email: customerInfo.email,
      address: customerInfo.address || '',
      city: customerInfo.city || '',
      state: customerInfo.state || '',
      postcode: customerInfo.postcode || '',
      country: customerInfo.country || 'Australia',
    };
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
    const order = await this.prisma.orders.create({
      data: {
        order_number: orderNumber,
        guest_email: customerInfo.email,
        subtotal: new Decimal(totals.subtotal),
        tax_amount: new Decimal(totals.gst),
        total_amount: new Decimal(totals.totalBeforeSurcharge),
        currency: (currency as string).toUpperCase(),
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'card',
        billing_address: address as any,
        shipping_address: address as any,
        items_count: validated.length,
        ip_address: ip || null,
        user_agent: '',
      } as any,
    });
    await this.prisma.order_items.createMany({
      data: validated.map((item) => ({
        order_id: order.id,
        product_id: item.productId ?? 0,
        product_name: item.name,
        product_sku: item.sku || '',
        quantity: item.quantity,
        unit_price: new Decimal(item.price),
        total_price: new Decimal(item.price * item.quantity),
        status: 'pending' as any,
      })),
    });
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: validated.map((item) => ({
        price_data: {
          currency: (currency as string).toLowerCase(),
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: success_url || `${this.config.get('FRONTEND_URL') || ''}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${this.config.get('FRONTEND_URL') || ''}/payment/cancel`,
      metadata: { orderId: String(order.id) },
    });
    await this.prisma.orders.update({ where: { id: order.id }, data: { payment_transaction_id: session.id } });
    return { sessionId: session.id, url: session.url, orderId: order.id };
  }

  async confirmPayment(body: any) {
    await this.invalidateCache();

    if (!this.stripe) throw new BadRequestException('Stripe is not configured');
    const { paymentIntentId, sessionId } = body || {};
    if (!paymentIntentId && !sessionId) throw new BadRequestException('paymentIntentId or sessionId required');
    let stripeStatus = 'succeeded';
    let orderId: number | null = null;
    if (sessionId) {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      stripeStatus = session.payment_status;
      const order = await this.prisma.orders.findFirst({ where: { payment_transaction_id: sessionId }, include: { order_items: true } });
      if (order) {
        orderId = order.id;
        await this.markOrderPaid(order, stripeStatus, sessionId);
      }
    } else if (paymentIntentId) {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      stripeStatus = intent.status;
      const order = await this.prisma.orders.findFirst({ where: { payment_transaction_id: paymentIntentId }, include: { order_items: true } });
      if (order) {
        orderId = order.id;
        await this.markOrderPaid(order, stripeStatus, paymentIntentId);
      }
    }
    return { success: stripeStatus === 'succeeded' || stripeStatus === 'paid', status: stripeStatus, orderId };
  }

  private async markOrderPaid(order: any, status: string, transactionId: string) {
    const paymentStatus = status === 'succeeded' || status === 'paid' ? 'paid' : status === 'pending' ? 'pending' : 'failed';
    const orderStatus = paymentStatus === 'paid' ? 'paid' : order.status;
    await this.prisma.orders.update({
      where: { id: order.id },
      data: { payment_status: paymentStatus, status: orderStatus, payment_transaction_id: transactionId } as any,
    });
    if (paymentStatus === 'paid') {
      await this.prisma.payments.create({
        data: {
          invoice_id: order.invoice_id ?? null,
          order_id: order.id,
          amount: order.total_amount,
          currency: order.currency,
          payment_method: 'card',
          payment_date: new Date(),
          status: 'completed',
          transaction_id: transactionId,
          notes: `Stripe payment for order ${order.order_number}`,
        } as any,
      });
    }
  }

  async getOrderBySession(sessionId: string) {
    return this.cached(this.cacheKey('getOrderBySession', sessionId), async () => {

      const order = await this.prisma.orders.findFirst({ where: { payment_transaction_id: sessionId }, include: { order_items: true } });
      if (!order) throw new NotFoundException('Order not found');
      return { order };


    });
}

  async getOrderById(id: number) {
    return this.cached(this.cacheKey('getOrderById', id), async () => {

      const order = await this.prisma.orders.findUnique({ where: { id }, include: { order_items: true } });
      if (!order) throw new NotFoundException('Order not found');
      return { order };


    });
}

  async handleStripeWebhook(payload: Buffer, signature: string) {
    await this.invalidateCache();

    if (!this.stripe) throw new BadRequestException('Stripe is not configured');
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;
    if (secret && signature) {
      try {
        event = this.stripe.webhooks.constructEvent(payload, signature, secret);
      } catch (err: any) {
        throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
      }
    } else {
      event = JSON.parse(payload.toString()) as Stripe.Event;
    }
    if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
      const obj: any = event.data.object;
      const sessionId = obj.id;
      const order = await this.prisma.orders.findFirst({ where: { payment_transaction_id: sessionId }, include: { order_items: true } });
      if (order) await this.markOrderPaid(order, 'paid', sessionId);
    }
    return { received: true };
  }
}
