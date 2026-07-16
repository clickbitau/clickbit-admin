import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PublicPaymentsController } from './payments-public.controller';
import { PublicPaymentsService } from './payments-public.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [AuthModule],
  controllers: [ExpensesController, PaymentsController, PublicPaymentsController, InvoicesController],
  providers: [ExpensesService, PaymentsService, PublicPaymentsService, InvoicesService],
})
export class FinanceModule {}
