import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnnouncementSchedulerService {
  private readonly logger = new Logger(AnnouncementSchedulerService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('* * * * *')
  async publishScheduledAnnouncements(): Promise<number> {
    if (!this.enabled) return 0;
    try {
      const now = new Date();
      const result = await this.prisma.hr_announcements.updateMany({
        where: { status: 'draft', publish_at: { lte: now } },
        data: { status: 'published', updated_at: now },
      });
      if (result.count) this.logger.log(`Published ${result.count} scheduled announcement(s)`);
      return result.count;
    } catch (e: any) {
      this.logger.error('Announcement scheduler failed', e?.message);
      return 0;
    }
  }
}
