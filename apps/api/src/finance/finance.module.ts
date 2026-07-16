import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [AuthModule],
  controllers: [ExpensesController, PaymentsController, InvoicesController],
  providers: [ExpensesService, PaymentsService, InvoicesService],
})
export class FinanceModule {}
