import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class PayrollAutomationService {
  private readonly logger = new Logger(PayrollAutomationService.name);

  constructor(private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('0 0 * * *')
  processPayroll(): void {
    if (!this.enabled) return;
    this.logger.log('Payroll automation scheduler triggered (payslip generation is deferred to gap-filling pass)');
  }
}
