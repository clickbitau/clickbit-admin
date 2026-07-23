import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from './contacts.service';

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contactsService: ContactsService,
  ) {}

  async dashboard(period = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(period));

    const [
      totalDeals,
      totalValue,
      wonDeals,
      lostDeals,
      totalCompanies,
      newCompanies,
      upcomingActivities,
      overdueActivities,
    ] = await Promise.all([
      this.prisma.deals.count({ where: { deleted_at: null, status: 'open' } }),
      this.prisma.deals.aggregate({
        where: { deleted_at: null, status: 'open' },
        _sum: { value: true },
      }),
      this.prisma.deals.findMany({
        where: {
          deleted_at: null,
          status: 'won',
          actual_close_date: { gte: startDate },
        },
      }),
      this.prisma.deals.count({
        where: {
          deleted_at: null,
          status: 'lost',
          actual_close_date: { gte: startDate },
        },
      }),
      this.prisma.companies.count({ where: { deleted_at: null, is_active: true } }),
      this.prisma.companies.count({
        where: { deleted_at: null, created_at: { gte: startDate } },
      }),
      this.prisma.crm_activities.count({
        where: {
          status: { in: ['planned', 'in_progress'] },
          due_date: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.crm_activities.count({
        where: {
          status: { in: ['planned', 'in_progress', 'overdue'] },
          due_date: { lt: new Date() },
        },
      }),
    ]);

    const closedDeals = wonDeals.length + lostDeals;
    const wonValue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    const winRate = closedDeals > 0 ? (wonDeals.length / closedDeals) * 100 : 0;

    const [pipelineValue, dealsByStage, recentDeals, topPerformers] = await Promise.all([
      this.prisma.deals.groupBy({
        by: ['pipeline_id'],
        where: { deleted_at: null, status: 'open' },
        _sum: { value: true },
        _count: { id: true },
      }).then((rows) =>
        Promise.all(
          rows.map(async (r) => ({
            pipeline_id: r.pipeline_id,
            total_value: Number(r._sum.value) || 0,
            deal_count: r._count.id,
            pipeline: await this.prisma.crm_pipelines.findUnique({
              where: { id: r.pipeline_id },
              select: { name: true },
            }),
          })),
        )
      ),
      this.prisma.deals.groupBy({
        by: ['stage_id'],
        where: { deleted_at: null, status: 'open' },
        _count: { id: true },
        _sum: { value: true },
      }).then((rows) =>
        Promise.all(
          rows.map(async (r) => ({
            stage_id: r.stage_id,
            count: r._count.id,
            value: Number(r._sum.value) || 0,
            stage: await this.prisma.crm_pipeline_stages.findUnique({
              where: { id: r.stage_id },
              select: { name: true, color: true, position: true },
            }),
          })),
        )
      ),
      this.prisma.deals.findMany({
        where: { created_at: { gte: startDate } },
        orderBy: { created_at: 'desc' },
        take: 10,
        include: {
          crm_pipeline_stages: { select: { name: true, color: true } },
          contacts: { select: { id: true, name: true, email: true } },
        },
      }).then(async (deals) => {
        const ownerIds = deals.map((d) => d.owner_id).filter(Boolean) as number[];
        const owners = await this.prisma.profiles.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, first_name: true, last_name: true, email: true },
        });
        const ownerMap = new Map(owners.map((o) => [o.id, o]));
        return deals.map((d) => ({
          ...d,
          owner: d.owner_id ? ownerMap.get(d.owner_id) || null : null,
        }));
      }),
      this.prisma.deals.groupBy({
        by: ['owner_id'],
        where: {
          deleted_at: null,
          status: 'won',
          actual_close_date: { gte: startDate },
          owner_id: { not: null },
        },
        _count: { id: true },
        _sum: { value: true },
      }).then(async (rows) => {
        const owners = await this.prisma.profiles.findMany({
          where: { id: { in: rows.map((r) => r.owner_id!).filter(Boolean) } },
          select: { id: true, first_name: true, last_name: true },
        });
        const ownerMap = new Map(owners.map((o) => [o.id, o]));
        return rows
          .map((r) => ({
            owner_id: r.owner_id,
            deals_won: r._count.id,
            total_value: Number(r._sum.value) || 0,
            owner: ownerMap.get(r.owner_id!),
          }))
          .sort((a, b) => b.total_value - a.total_value)
          .slice(0, 5);
      }),
    ]);

    return {
      overview: {
        totalDeals,
        totalValue: Number(totalValue._sum.value) || 0,
        wonDeals: wonDeals.length,
        wonValue,
        lostDeals,
        winRate: Math.round(winRate * 100) / 100,
        totalCompanies,
        newCompanies,
        upcomingActivities,
        overdueActivities,
      },
      pipelineValue,
      dealsByStage: dealsByStage.sort((a, b) => (a.stage?.position || 0) - (b.stage?.position || 0)),
      recentDeals,
      topPerformers,
      period: Number(period),
    };
  }

  async customers(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
  }) {
    const result = await this.contactsService.findAll({
      ...query,
      lifecycle_stage: 'customer',
    });

    return {
      success: true,
      data: (result as any).contacts || [],
      pagination: (result as any).pagination,
    };
  }
}
