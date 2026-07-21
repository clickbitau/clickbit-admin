import { Injectable } from '@nestjs/common';
import { generateInvoicePDF } from '../common/pdf/invoice-pdf';

@Injectable()
export class PdfService {
  generateInvoicePDF(
    packageData: any,
    billingSettings: any = {},
    _templateSettings: any = {},
    verificationCode?: string | null,
  ): Promise<Buffer> {
    return generateInvoicePDF(packageData, billingSettings, _templateSettings, verificationCode ?? null);
  }
}
