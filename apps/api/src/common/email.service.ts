import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {}

  private getTransporter() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<string>('SMTP_PORT') || '587';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';

    if (!host || !user || !pass) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
  }

  async send(options: {
    to: string;
    from?: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: { filename: string; content: Buffer; contentType?: string }[];
  }): Promise<{ sent: boolean; messageId?: string; error?: string }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { sent: false, error: 'SMTP is not configured' };
    }

    try {
      const defaultFrom = this.config.get<string>('EMAIL_FROM') || this.config.get<string>('SMTP_USER') || 'noreply@clickbit.com.au';
      const result = await transporter.sendMail({
        from: options.from || defaultFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      });
      return { sent: true, messageId: result.messageId };
    } catch (err: any) {
      return { sent: false, error: err.message || 'Failed to send email' };
    }
  }

  async sendInvoiceEmail(invoice: any, pdfBuffer: Buffer, origin?: string): Promise<{ sent: boolean; paymentUrl: string; messageId?: string; error?: string }> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || origin || 'https://clickbit.com.au';
    const tokenParam = invoice.token ? `?token=${invoice.token}` : '';
    const paymentUrl = `${frontendUrl}/pay/${invoice.package_code}${tokenParam}`;

    const subject = `Invoice ${invoice.package_code} from ClickBit`;
    const html = `
      <div style="font-family: Sora, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
        <h2 style="color: #1FBBD2;">Hi ${invoice.client_name || 'there'},</h2>
        <p>Please find your invoice attached.</p>
        <p><strong>Invoice number:</strong> ${invoice.package_code}<br/>
        <strong>Amount due:</strong> $${Number(invoice.total_amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
        <p>You can view and pay online here:</p>
        <p><a href="${paymentUrl}" style="background: #F39C12; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Pay Invoice</a></p>
        <p style="color: #94A3B8; font-size: 12px;">Bank transfer details are included on the attached PDF.</p>
      </div>
    `;

    const result = await this.send({
      to: invoice.client_email,
      subject,
      html,
      attachments: [
        {
          filename: `Invoice_${invoice.package_code}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return { ...result, paymentUrl };
  }
}
