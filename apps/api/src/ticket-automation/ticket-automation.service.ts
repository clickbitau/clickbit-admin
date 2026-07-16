import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const repoInclude = {
  profiles_customer_repositories_profile_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
  companies: { select: { id: true, name: true } },
};

function normalizeRepo(r: any) {
  return { ...r, customer: r.profiles_customer_repositories_profile_idToprofiles, company: r.companies };
}

@Injectable()
export class TicketAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  getRepos() {
    return { success: true, data: ['clickbitau/clickbit', 'clickbitau/clickbit-admin', 'clickbitau/click-deploy'] };
  }

  async getCustomers() {
    const customers = await this.prisma.profiles.findMany({
      where: { role: 'customer' },
      select: { id: true, first_name: true, last_name: true, email: true, company_id: true },
      orderBy: { first_name: 'asc' },
    });
    return { success: true, data: customers };
  }

  async findRepositories() {
    const rows = await this.prisma.customer_repositories.findMany({
      include: repoInclude,
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: rows.map(normalizeRepo) };
  }

  async createRepository(userId: number, dto: any) {
    if (!dto.repo_full_name) throw new BadRequestException('repo_full_name is required');
    if (!dto.profile_id && !dto.company_id) throw new BadRequestException('Either profile_id or company_id is required');
    const repo = await this.prisma.customer_repositories.create({
      data: {
        profile_id: dto.profile_id ? Number(dto.profile_id) : null,
        company_id: dto.company_id ? Number(dto.company_id) : null,
        repo_full_name: dto.repo_full_name,
        auto_fix_enabled: dto.auto_fix_enabled !== undefined ? dto.auto_fix_enabled : true,
        require_approval: dto.require_approval !== undefined ? dto.require_approval : true,
        created_by: userId,
      },
      include: repoInclude,
    });
    return { success: true, data: normalizeRepo(repo) };
  }

  async updateRepository(id: number, dto: any) {
    const existing = await this.prisma.customer_repositories.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Link not found');
    const repo = await this.prisma.customer_repositories.update({
      where: { id },
      data: {
        ...(dto.repo_full_name !== undefined ? { repo_full_name: dto.repo_full_name } : {}),
        ...(dto.auto_fix_enabled !== undefined ? { auto_fix_enabled: dto.auto_fix_enabled } : {}),
        ...(dto.require_approval !== undefined ? { require_approval: dto.require_approval } : {}),
        ...(dto.profile_id !== undefined ? { profile_id: dto.profile_id ? Number(dto.profile_id) : null } : {}),
        ...(dto.company_id !== undefined ? { company_id: dto.company_id ? Number(dto.company_id) : null } : {}),
      },
      include: repoInclude,
    });
    return { success: true, data: normalizeRepo(repo) };
  }

  async removeRepository(id: number) {
    const existing = await this.prisma.customer_repositories.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Link not found');
    await this.prisma.customer_repositories.delete({ where: { id } });
    return { success: true, message: 'Link removed' };
  }

  async findQuotas() {
    const rows = await this.prisma.ticket_quotas.findMany({
      include: {
        profiles_ticket_quotas_profile_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy: { updated_at: 'desc' },
    });
    return {
      success: true,
      data: rows.map((q) => ({ ...q, customer: q.profiles_ticket_quotas_profile_idToprofiles })),
      defaults: { free_limit: 5, period: 'monthly', price_cents: 5000, currency: 'AUD' },
    };
  }

  async getQuota(profileId: number) {
    const quota = await this.prisma.ticket_quotas.findUnique({
      where: { profile_id: profileId },
      include: {
        profiles_ticket_quotas_profile_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
    });
    if (!quota) return { success: true, data: { profile_id: profileId, free_limit: 5, period: 'monthly', price_cents: 5000, currency: 'AUD', used: 0, purchased: 0 } };
    return { success: true, data: { ...quota, customer: quota.profiles_ticket_quotas_profile_idToprofiles } };
  }

  async updateQuota(userId: number, profileId: number, dto: any) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Customer not found');
    if (dto.period && !['weekly', 'monthly'].includes(dto.period)) throw new BadRequestException('period must be weekly or monthly');

    const quota = await this.prisma.ticket_quotas.upsert({
      where: { profile_id: profileId },
      create: {
        profile_id: profileId,
        free_limit: Math.max(0, Number(dto.free_limit) || 5),
        period: dto.period || 'monthly',
        price_cents: Math.max(0, Number(dto.price_cents) || 5000),
        currency: dto.currency || 'AUD',
        updated_by: userId,
      },
      update: {
        ...(dto.free_limit !== undefined ? { free_limit: Math.max(0, Number(dto.free_limit) || 0) } : {}),
        ...(dto.period !== undefined ? { period: dto.period } : {}),
        ...(dto.price_cents !== undefined ? { price_cents: Math.max(0, Number(dto.price_cents) || 0) } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        updated_by: userId,
      },
      include: {
        profiles_ticket_quotas_profile_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
    });
    return { success: true, data: { ...quota, customer: quota.profiles_ticket_quotas_profile_idToprofiles } };
  }

  async findManualReview() {
    const tickets = await this.prisma.tickets.findMany({
      where: { auto_fix_status: 'manual_review' },
      select: { id: true, ticket_number: true, subject: true, category: true, priority: true, status: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    return { success: true, data: tickets };
  }

  async findPurchases() {
    const rows = await this.prisma.ticket_purchases.findMany({
      include: {
        profiles_ticket_purchases_profile_idToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    return { success: true, data: rows.map((p) => ({ ...p, customer: p.profiles_ticket_purchases_profile_idToprofiles })) };
  }
}
