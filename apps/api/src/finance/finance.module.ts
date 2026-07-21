import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../common/email.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PublicPaymentsController } from './payments-public.controller';
import { PublicPaymentsService } from './payments-public.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PublicInvoicesController } from './public-invoices.controller';
import { PublicInvoicesService } from './public-invoices.service';
import { PdfService } from './pdf.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuthModule, SettingsModule],
  exports: [PublicInvoicesService, PdfService],
  controllers: [
    ExpensesController,
    PaymentsController,
    PublicPaymentsController,
    InvoicesController,
    PublicInvoicesController,
  ],
  providers: [
    ExpensesService,
    PaymentsService,
    PublicPaymentsService,
    InvoicesService,
    PublicInvoicesService,
    PdfService,
    EmailService,
  ],
})
export class FinanceModule {}
