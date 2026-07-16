import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailSyncWorkerService {
  private readonly logger = new Logger(MailSyncWorkerService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('*/5 * * * *')
  syncAllActiveAccounts(): void {
    if (!this.enabled) return;
    this.logger.log('Mail sync worker triggered (IMAP/SMTP integration deferred to gap-filling pass)');
  }
}
