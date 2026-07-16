import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionSyncService {
  private readonly logger = new Logger(SessionSyncService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('0 * * * *')
  async cleanupExpiredSessions(): Promise<void> {
    if (!this.enabled) return;
    try {
      const now = new Date();
      const result = await this.prisma.sessions.deleteMany({
        where: { not_after: { lt: now } },
      });
      if (result.count) this.logger.log(`Cleaned up ${result.count} expired session(s)`);
    } catch (e: any) {
      this.logger.error('Session sync failed', e?.message);
    }
  }
}
