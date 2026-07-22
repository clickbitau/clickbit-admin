import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { MailImapService } from '../communication/mail-imap.service';

@Injectable()
export class MailSyncWorkerService {
  private readonly logger = new Logger(MailSyncWorkerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly imap: MailImapService,
  ) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('*/5 * * * *')
  async syncAllActiveAccounts(): Promise<void> {
    if (!this.enabled) return;
    this.logger.log('Mail sync worker started');
    try {
      await this.imap.syncAllActiveAccounts();
      this.logger.log('Mail sync worker completed');
    } catch (e: any) {
      this.logger.error(`Mail sync worker failed: ${e.message}`);
    }
  }
}
