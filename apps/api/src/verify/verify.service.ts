import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';

@Injectable()
export class VerifyService {
  constructor(private readonly prisma: PrismaService,
    private readonly cache?: CacheService) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('verify', ...parts) ?? `verify:` + parts.filter((p) => p !== undefined && p !== null).join(':');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }


  async verify(code: string, clientIp?: string) {
    await this.invalidateCache();

    if (!code || code.length < 5) {
      return { valid: false, error: 'Invalid verification code format' };
    }
    const row = await this.prisma.document_verifications.findUnique({
      where: { verification_code: code.toUpperCase() },
    });
    if (!row || row.is_voided) {
      return { valid: false, error: 'Verification code not found' };
    }
    await this.prisma.document_verifications.update({
      where: { id: row.id },
      data: {
        verified_count: { increment: 1 },
        last_verified_at: new Date(),
        last_verified_ip: clientIp || null,
      },
    });
    return {
      valid: true,
      document: {
        id: row.id,
        document_type: row.document_type,
        document_number: row.document_number,
        issued_to_name: row.issued_to_name,
        issued_to_company: row.issued_to_company,
        issued_date: row.issued_date,
        amount: row.amount,
        currency: row.currency,
        verified_count: (row.verified_count ?? 0) + 1,
        last_verified_at: new Date(),
      },
    };
  }

  async exists(code: string) {
    await this.invalidateCache();

    const row = await this.prisma.document_verifications.findUnique({
      where: { verification_code: code.toUpperCase() },
      select: { id: true },
    });
    return !!row;
  }

  async stats() {
    return this.cached(this.cacheKey('stats'), async () => {

      const rows = await this.prisma.document_verifications.groupBy({
        by: ['document_type'],
        _count: { id: true },
        _sum: { verified_count: true },
      });
      return {
        stats: rows.map((r) => ({
          document_type: r.document_type,
          count: r._count.id,
          total_verifications: r._sum.verified_count ?? 0,
        })),
      };


    });
}
}
