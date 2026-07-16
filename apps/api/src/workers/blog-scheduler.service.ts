import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlogSchedulerService {
  private readonly logger = new Logger(BlogSchedulerService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('* * * * *')
  async publishScheduledPosts(): Promise<number> {
    if (!this.enabled) return 0;
    try {
      const now = new Date();
      const result = await this.prisma.blog_posts.updateMany({
        where: { status: 'scheduled', scheduled_at: { lte: now }, deleted_at: null },
        data: { status: 'published', published_at: now, scheduled_at: null, updated_at: now },
      });
      if (result.count) {
        this.logger.log(`Published ${result.count} scheduled blog post(s)`);
      }
      return result.count;
    } catch (e: any) {
      this.logger.error('Blog scheduler failed', e?.message);
      return 0;
    }
  }

  async getScheduledPosts(): Promise<{ id: number; title: string; slug: string; scheduled_at: Date | null; created_at: Date | null }[]> {
    return this.prisma.blog_posts.findMany({
      where: { status: 'scheduled', deleted_at: null },
      orderBy: { scheduled_at: 'asc' },
      select: { id: true, title: true, slug: true, scheduled_at: true, created_at: true },
    });
  }
}
