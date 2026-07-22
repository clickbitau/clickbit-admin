import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildLegacyDataEnvelope, buildLegacyMessageEnvelope, stringValue } from './support-utils';
import { CacheService } from '../redis/cache.service';

@Injectable()
export class TicketAutomationService {
  private readonly defaultLimit = 5;
  private readonly defaultPeriod = 'monthly';
  private readonly defaultPriceCents = 5000;
  private readonly defaultCurrency = 'AUD';

  constructor(private readonly prisma: PrismaService,
    private readonly cache?: CacheService) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('ticket-automation', ...parts) ?? `ticket-automation:` + parts.filter((p) => p !== undefined && p !== null).join(':');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }


  getRepos() {
    return buildLegacyDataEnvelope(['clickbitau/clickbit', 'clickbitau/clickbit-admin', 'clickbitau/click-deploy']);
  }

  async getCustomers() {
    return this.cached(this.cacheKey('getCustomers'), async () => {

      const customers = await this.prisma.profiles.findMany({
        where: { role: 'customer' },
        select: { id: true, first_name: true, last_name: true, email: true, company_id: true },
        orderBy: { first_name: 'asc' },
      });
      return buildLegacyDataEnvelope(customers);


    });
}

  async getCustomerRepositories() {
    return this.cached(this.cacheKey('getCustomerRepositories'), async () => {

      const links = await this.prisma.customer_repositories.findMany({
        include: {
          profiles_customer_repositories_profile_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
          companies: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
      });
      const mapped = links.map((l) => {
        const profile = l.profiles_customer_repositories_profile_idToprofiles;
        return {
          ...l,
          customer: profile,
          company: l.companies,
          profiles_customer_repositories_profile_idToprofiles: undefined,
          companies: undefined,
        };
      });
      return buildLegacyDataEnvelope(mapped);


    });
}

  async createCustomerRepository(dto: Record<string, unknown>) {
    await this.invalidateCache();

    const repoFullName = stringValue(dto.repo_full_name);
    const profileId = dto.profile_id ? Number(dto.profile_id) : null;
    const companyId = dto.company_id ? Number(dto.company_id) : null;
    if (!repoFullName) throw new BadRequestException({ message: 'repo_full_name is required' });
    if (!profileId && !companyId) throw new BadRequestException({ message: 'Either profile_id or company_id is required' });

    const created = await this.prisma.customer_repositories.create({
      data: {
        profile_id: profileId,
        company_id: companyId,
        repo_full_name: repoFullName,
        auto_fix_enabled: dto.auto_fix_enabled !== undefined ? Boolean(dto.auto_fix_enabled) : true,
        require_approval: dto.require_approval !== undefined ? Boolean(dto.require_approval) : true,
      },
    });
    return buildLegacyDataEnvelope(created);
  }

  async updateCustomerRepository(id: number, dto: Record<string, unknown>) {
    await this.invalidateCache();

    const existing = await this.prisma.customer_repositories.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ message: 'Link not found' });

    const data: Record<string, unknown> = {};
    if (dto.repo_full_name !== undefined) data.repo_full_name = stringValue(dto.repo_full_name);
    if (dto.auto_fix_enabled !== undefined) data.auto_fix_enabled = Boolean(dto.auto_fix_enabled);
    if (dto.require_approval !== undefined) data.require_approval = Boolean(dto.require_approval);
    if (dto.profile_id !== undefined) data.profile_id = dto.profile_id ? Number(dto.profile_id) : null;
    if (dto.company_id !== undefined) data.company_id = dto.company_id ? Number(dto.company_id) : null;

    const updated = await this.prisma.customer_repositories.update({ where: { id }, data });
    return buildLegacyDataEnvelope(updated);
  }

  async deleteCustomerRepository(id: number) {
    await this.invalidateCache();

    const existing = await this.prisma.customer_repositories.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ message: 'Link not found' });
    await this.prisma.customer_repositories.delete({ where: { id } });
    return buildLegacyMessageEnvelope('Link removed');
  }

  async getQuotas() {
    return this.cached(this.cacheKey('getQuotas'), async () => {

      const quotas = await this.prisma.ticket_quotas.findMany({
        include: {
          profiles_ticket_quotas_profile_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
        orderBy: { updated_at: 'desc' },
      });
      const mapped = quotas.map((q) => {
        const profile = q.profiles_ticket_quotas_profile_idToprofiles;
        return { ...q, customer: profile, profiles_ticket_quotas_profile_idToprofiles: undefined };
      });
      return {
        success: true,
        data: mapped,
        defaults: {
          free_limit: this.defaultLimit,
          period: this.defaultPeriod,
          price_cents: this.defaultPriceCents,
          currency: this.defaultCurrency,
        },
      };


    });
}

  async getQuota(profileId: number) {
    return this.cached(this.cacheKey('getQuota', profileId), async () => {

      const profile = await this.prisma.profiles.findUnique({ where: { id: profileId }, select: { id: true } });
      if (!profile) throw new NotFoundException({ message: 'Customer not found' });

      const quota = await this.prisma.ticket_quotas.findUnique({ where: { profile_id: profileId } });
      return buildLegacyDataEnvelope(
        quota || {
          profile_id: profileId,
          free_limit: this.defaultLimit,
          period: this.defaultPeriod,
          price_cents: this.defaultPriceCents,
          currency: this.defaultCurrency,
        },
      );


    });
}

  async updateQuota(profileId: number, dto: Record<string, unknown>) {
    await this.invalidateCache();

    const profile = await this.prisma.profiles.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) throw new NotFoundException({ message: 'Customer not found' });

    const period = dto.period ? stringValue(dto.period) : undefined;
    if (period && !['weekly', 'monthly'].includes(period)) throw new BadRequestException({ message: 'period must be weekly or monthly' });

    const updated = await this.prisma.ticket_quotas.upsert({
      where: { profile_id: profileId },
      create: {
        profile_id: profileId,
        free_limit: dto.free_limit !== undefined ? Math.max(0, Number(dto.free_limit)) : this.defaultLimit,
        period: (period as any) || this.defaultPeriod,
        price_cents: dto.price_cents !== undefined ? Math.max(0, Number(dto.price_cents)) : this.defaultPriceCents,
        currency: dto.currency ? stringValue(dto.currency) : this.defaultCurrency,
      },
      update: {
        free_limit: dto.free_limit !== undefined ? Math.max(0, Number(dto.free_limit)) : undefined,
        period: (period as any) || undefined,
        price_cents: dto.price_cents !== undefined ? Math.max(0, Number(dto.price_cents)) : undefined,
        currency: dto.currency !== undefined ? stringValue(dto.currency) : undefined,
      },
    });

    return buildLegacyDataEnvelope(updated);
  }

  async getManualReview() {
    return this.cached(this.cacheKey('getManualReview'), async () => {

      const tickets = await this.prisma.tickets.findMany({
        where: { auto_fix_status: 'manual_review' },
        select: {
          id: true,
          ticket_number: true,
          subject: true,
          category: true,
          priority: true,
          status: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: 100,
      });
      return buildLegacyDataEnvelope(tickets);


    });
}

  async getPurchases() {
    return this.cached(this.cacheKey('getPurchases'), async () => {

      const purchases = await this.prisma.ticket_purchases.findMany({
        include: {
          profiles_ticket_purchases_profile_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 200,
      });
      const mapped = purchases.map((p) => {
        const profile = p.profiles_ticket_purchases_profile_idToprofiles;
        return { ...p, customer: profile, profiles_ticket_purchases_profile_idToprofiles: undefined };
      });
      return buildLegacyDataEnvelope(mapped);


    });
}
}
