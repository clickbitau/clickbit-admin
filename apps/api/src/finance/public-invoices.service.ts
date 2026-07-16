import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from './pdf.service';
import { invoiceInclude, mapInvoice, parseNumber } from './finance-utils';

const CARD_SURCHARGE_RATE = 0.02;

@Injectable()
export class PublicInvoicesService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly config: ConfigService,
  ) {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secret) {
      this.stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' as any });
    }
  }

  private toNumber(value: unknown): number {
    return parseNumber(value);
  }

  private async loadBillingSettings() {
    const [bankAccount, taxSettings, companyInfo] = await Promise.all([
      this.prisma.bank_accounts.findFirst({ where: { is_primary: true, deleted_at: null } }),
      this.prisma.tax_settings.findFirst({ where: { id: 1 } }),
      this.prisma.company_info.findFirst({ where: { id: 1 } }),
    ]);

    return {
      bankAccountName: bankAccount?.account_name || '',
      bankBSB: bankAccount?.bsb || '',
      bankAccountNumber: bankAccount?.account_number || '',
      companyAbn: companyInfo?.abn || '',
      taxType: (taxSettings?.tax_type as string) || 'gst_included',
      taxRate: this.toNumber(taxSettings?.tax_rate) || 10,
    };
  }

  private async generateVerificationCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    let exists = true;

    while (exists) {
      const random = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      code = `VRF-CLK-${random}`;
      const row = await this.prisma.document_verifications.findUnique({ where: { verification_code: code } });
      exists = !!row;
    }

    return code!;
  }

  private generateDocumentHash(data: any): string {
    const payload = [
      data.document_type,
      data.document_id,
      data.document_number || '',
      this.toNumber(data.amount),
      data.issued_date ? new Date(data.issued_date).toISOString() : '',
      data.bank_bsb || '',
      data.bank_account_last4 || '',
    ].join('|');

    return createHash('sha256').update(payload).digest('hex');
  }

  private async createVerificationForInvoice(invoice: any, settings: any): Promise<string> {
    const code = await this.generateVerificationCode();
    const accountLast4 = (settings.bankAccountNumber || '').slice(-4);

    const data: any = {
      verification_code: code,
      document_type: invoice.document_type === 'estimate' ? 'estimate' : 'invoice',
      document_id: invoice.id,
      document_number: invoice.package_code || `INV-${invoice.id}`,
      amount: this.toNumber(invoice.total_amount),
      currency: invoice.currency || 'AUD',
      issued_to_name: invoice.client_name || '',
      issued_to_company: invoice.client_company || '',
      issued_date: invoice.issue_date || invoice.created_at || new Date(),
      bank_bsb: settings.bankBSB || '',
      bank_account_last4: accountLast4,
      bank_account_name: settings.bankAccountName || '',
    };

    data.document_hash = this.generateDocumentHash(data);

    await this.prisma.document_verifications.create({ data });
    return code;
  }

  private toPackageData(normalized: any) {
    const paymentHistory = (normalized.payments || []).map((p: any) => ({
      amount: this.toNumber(p.amount),
      method: p.payment_method || 'Unknown',
      date: p.payment_date || p.created_at,
      reference: p.transaction_id || p.notes || '',
    }));

    return {
      ...normalized,
      payment_history: paymentHistory,
    };
  }

  private async buildPdfData(invoiceOrId: any) {
    const invoice =
      typeof invoiceOrId === 'number'
        ? await this.prisma.invoices.findUnique({ where: { id: invoiceOrId, deleted_at: null }, include: invoiceInclude })
        : invoiceOrId;

    if (!invoice) throw new NotFoundException('Invoice not found');

    const normalized = 'id' in invoice && 'line_items' in invoice ? mapInvoice(invoice, true) : invoice;
    const billingSettings = await this.loadBillingSettings();
    const verificationCode = await this.createVerificationForInvoice(normalized, billingSettings);
    const packageData = this.toPackageData(normalized);
    const docType = (packageData.document_type || 'invoice').charAt(0).toUpperCase() + (packageData.document_type || 'invoice').slice(1);
    const filename = `${docType}_${packageData.package_code}.pdf`;

    return { packageData, billingSettings, verificationCode, filename };
  }

  async generatePdf(invoiceOrId: any): Promise<{ buffer: Buffer; filename: string }> {
    const { packageData, billingSettings, verificationCode, filename } = await this.buildPdfData(invoiceOrId);
    const buffer = await this.pdfService.generateInvoicePDF(packageData, billingSettings, {}, verificationCode);
    return { buffer, filename };
  }

  private async getInvoiceByCode(code: string) {
    const invoice = await this.prisma.invoices.findUnique({ where: { package_code: code }, include: invoiceInclude });
    if (!invoice || invoice.deleted_at) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private validateToken(invoice: any, token?: string) {
    if (!invoice.token) {
      throw new BadRequestException('Invoice is not available for public access');
    }
    if (invoice.token !== token) {
      throw new BadRequestException('Invalid security token');
    }
  }

  async getPublicInvoice(code: string, token?: string) {
    const invoice = await this.getInvoiceByCode(code);
    this.validateToken(invoice, token);

    await this.recalcPaymentStatus(invoice.id);
    const refreshed = await this.prisma.invoices.findUnique({ where: { id: invoice.id }, include: invoiceInclude });

    if (refreshed!.status === 'sent') {
      await this.prisma.invoices.update({
        where: { id: refreshed!.id },
        data: { status: 'viewed', viewed_at: new Date() },
      });
    }

    const normalized = mapInvoice(refreshed!, true);
    const totalAmount = this.toNumber(normalized.total_amount);
    const amountPaid = this.toNumber(normalized.amount_paid);
    const amountDue = Math.max(0, totalAmount - amountPaid);
    const isExpired = this.isExpired(refreshed!, normalized);

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'https://clickbit.com.au';
    const paymentLink = `${frontendUrl}/pay/${refreshed!.package_code}${token ? `?token=${token}` : ''}`;

    return {
      invoice_number: refreshed!.package_code,
      package_code: refreshed!.package_code,
      client_name: refreshed!.client_name || '',
      client_email: refreshed!.client_email || '',
      client_company: refreshed!.client_company || '',
      title: refreshed!.title || '',
      description: refreshed!.description || '',
      type: normalized.document_type || 'invoice',
      template_type: refreshed!.template_type || 'tax_excluded',
      items: normalized.line_items || [],
      subtotal: this.toNumber(normalized.subtotal),
      tax_type: normalized.tax_type || 'gst_included',
      tax_rate: this.toNumber(normalized.tax_rate),
      tax_amount: this.toNumber(normalized.tax_amount),
      discount_amount: this.toNumber(normalized.discount_amount),
      total: totalAmount,
      amount_paid: amountPaid,
      amount_due: amountDue,
      currency: refreshed!.currency || 'AUD',
      terms: refreshed!.terms || '',
      client_notes: refreshed!.client_notes || '',
      valid_until: refreshed!.valid_until,
      status: refreshed!.status,
      sent_at: refreshed!.sent_at,
      is_paid: refreshed!.status === 'paid',
      is_expired: isExpired,
      payment_link: paymentLink,
      payment_options: {
        card_surcharge_rate: CARD_SURCHARGE_RATE * 100,
        half_payment: this.buildPaymentOption(totalAmount, amountPaid, amountDue, 'half'),
        full_payment: this.buildPaymentOption(totalAmount, amountPaid, amountDue, 'full'),
      },
    };
  }

  private isExpired(invoice: any, _normalized: any): boolean {
    if (invoice.valid_until) {
      return new Date(invoice.valid_until) < new Date();
    }
    if (invoice.status === 'sent' || invoice.status === 'viewed') {
      if (invoice.sent_at) {
        const expiry = new Date(invoice.sent_at);
        expiry.setDate(expiry.getDate() + 14);
        return new Date() > expiry;
      }
    }
    return false;
  }

  private buildPaymentOption(totalAmount: number, amountPaid: number, amountDue: number, type: 'half' | 'full') {
    let baseAmount = amountDue;
    if (type === 'half') {
      const halfOfTotal = totalAmount / 2;
      baseAmount = amountPaid >= halfOfTotal ? amountDue : halfOfTotal;
    }
    const surcharge = baseAmount * CARD_SURCHARGE_RATE;
    const total = baseAmount + surcharge;
    return {
      base_amount: baseAmount,
      surcharge,
      total,
      available: amountDue > 0 && baseAmount <= amountDue,
    };
  }

  private async recalcPaymentStatus(invoiceId: number) {
    const invoice = await this.prisma.invoices.findUnique({ where: { id: invoiceId } });
    if (!invoice) return;

    const result = await this.prisma.payments.aggregate({
      where: { invoice_id: invoiceId, deleted_at: null, status: 'completed' },
      _sum: { amount: true },
    });

    const paid = this.toNumber(result._sum.amount);
    const total = this.toNumber(invoice.total_amount);

    let status = invoice.status as string;
    let paidAt = invoice.paid_at;

    if (paid >= total) {
      status = 'paid';
      paidAt = paidAt || new Date();
    } else if (paid > 0) {
      status = 'partial';
      paidAt = null;
    } else if (status === 'paid' || status === 'partial') {
      status = 'sent';
      paidAt = null;
    }

    await this.prisma.invoices.update({
      where: { id: invoiceId },
      data: { amount_paid: paid, status, paid_at: paidAt },
    });
  }

  async getPublicInvoicePdf(code: string, token?: string): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.getInvoiceByCode(code);
    this.validateToken(invoice, token);
    return this.generatePdf(invoice);
  }

  async createCheckoutSession(code: string, body: any, token?: string) {
    if (!this.stripe) throw new BadRequestException('Payment processing is not configured');

    const invoice = await this.getInvoiceByCode(code);
    this.validateToken(invoice, token);

    if (this.isExpired(invoice, mapInvoice(invoice, true))) {
      throw new BadRequestException('This invoice has expired');
    }
    if (invoice.status === 'paid') {
      throw new BadRequestException('This invoice has already been paid');
    }

    await this.recalcPaymentStatus(invoice.id);
    const refreshed = await this.prisma.invoices.findUnique({ where: { id: invoice.id }, include: invoiceInclude });
    const normalized = mapInvoice(refreshed!, true);

    const totalAmount = this.toNumber(normalized.total_amount);
    const amountPaid = this.toNumber(normalized.amount_paid);
    const amountDue = Math.max(0, totalAmount - amountPaid);

    if (amountDue <= 0) {
      throw new BadRequestException('This invoice has already been fully paid');
    }

    const paymentType = (body?.payment_type as string) || 'full';
    let paymentAmount = amountDue;
    if (paymentType === 'half') {
      const halfOfTotal = totalAmount / 2;
      paymentAmount = amountPaid >= halfOfTotal ? amountDue : halfOfTotal;
    }

    const surchargeAmount = paymentAmount * CARD_SURCHARGE_RATE;
    const totalWithSurcharge = paymentAmount + surchargeAmount;

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'https://clickbit.com.au';
    const tokenParam = token ? `&token=${token}` : '';
    const successUrl = `${frontendUrl}/pay/${invoice.package_code}?session_id={CHECKOUT_SESSION_ID}${tokenParam}`;
    const cancelUrl = `${frontendUrl}/pay/${invoice.package_code}${tokenParam ? `?${tokenParam.slice(1)}` : ''}`;

    const lineItems: any[] = [
      {
        price_data: {
          currency: (invoice.currency || 'AUD').toLowerCase(),
          product_data: { name: paymentType === 'half' ? `${invoice.title || 'Invoice'} - 50% Deposit` : invoice.title || 'Invoice Payment' },
          unit_amount: Math.round(paymentAmount * 100),
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: (invoice.currency || 'AUD').toLowerCase(),
          product_data: { name: 'Card Payment Surcharge (2%)', description: 'Credit/Debit card processing fee' },
          unit_amount: Math.round(surchargeAmount * 100),
        },
        quantity: 1,
      },
    ];

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      customer_email: invoice.client_email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        invoice_id: invoice.id.toString(),
        invoice_number: invoice.package_code,
        package_id: invoice.id.toString(),
        client_email: invoice.client_email || '',
        client_name: invoice.client_name || '',
        payment_type: paymentType,
        base_amount: paymentAmount.toString(),
        surcharge_amount: surchargeAmount.toString(),
        total_charged: totalWithSurcharge.toString(),
      },
    });

    await this.prisma.invoices.update({
      where: { id: invoice.id },
      data: { stripe_session_id: session.id, stripe_checkout_url: session.url },
    });

    return {
      url: session.url,
      payment_details: {
        base_amount: paymentAmount,
        surcharge_amount: surchargeAmount,
        surcharge_rate: CARD_SURCHARGE_RATE * 100,
        total_charged: totalWithSurcharge,
        payment_type: paymentType,
      },
    };
  }

  async confirmPayment(code: string, sessionId: string, token?: string) {
    const invoice = await this.getInvoiceByCode(code);
    this.validateToken(invoice, token);

    if (!this.stripe || !sessionId) {
      return { success: invoice.status === 'paid', package: mapInvoice(invoice, true) };
    }

    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if ((session.payment_status === 'paid' || session.payment_status === 'paid' as any) && invoice.status !== 'paid') {
      const metadata = session.metadata || {};
      const baseAmount = this.toNumber(metadata.base_amount) || this.toNumber(invoice.total_amount);
      const surcharge = this.toNumber(metadata.surcharge_amount);

      await this.prisma.payments.create({
        data: {
          invoice_id: invoice.id,
          amount: baseAmount + surcharge,
          currency: invoice.currency || 'AUD',
          payment_provider: 'stripe',
          payment_method: 'card',
          transaction_id: session.id,
          status: 'completed',
          gateway_response: JSON.stringify(session),
          payment_date: new Date(),
          notes: `Stripe checkout session ${sessionId}`,
        } as any,
      });

      await this.recalcPaymentStatus(invoice.id);
    }

    const refreshed = await this.prisma.invoices.findUnique({ where: { id: invoice.id }, include: invoiceInclude });
    return {
      success: refreshed!.status === 'paid',
      package: mapInvoice(refreshed!, true),
    };
  }
}
