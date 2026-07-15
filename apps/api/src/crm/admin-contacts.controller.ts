import { Controller, Get, Put, Param, Query, Body, ParseIntPipe, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { setNoCache } from './crm-utils';

@Controller('admin/contacts')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class AdminContactsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll(
    @Query() query: { page?: string; limit?: string; search?: string; lifecycle_stage?: string; status?: string; sortBy?: string; sortOrder?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const where: { [key: string]: unknown } = { deleted_at: null };

    if (query.lifecycle_stage) where.lifecycle_stage = query.lifecycle_stage;
    if (query.status) where.lead_status = query.status;
    if (query.search) {
      (where as { OR: unknown[] }).OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { company: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: { [key: string]: 'asc' | 'desc' } = {
      [query.sortBy || 'created_at']: query.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [contacts, total] = await Promise.all([
      this.prisma.contacts.findMany({
        where,
        include: {
          companies_contacts_company_idTocompanies: { select: { id: true, name: true } },
          profiles: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.contacts.count({ where }),
    ]);

    return {
      contacts: contacts.map((c) => this.mapContact(c)),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }

  @Get('customer-stats')
  async customerStats(@Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    const total = await this.prisma.contacts.count({
      where: { deleted_at: null, lifecycle_stage: 'customer' },
    });
    const activeCustomers = await this.prisma.contacts.count({
      where: { deleted_at: null, lifecycle_stage: 'customer', lead_status: 'active' },
    });
    const revenue = await this.prisma.contacts.aggregate({
      where: { deleted_at: null, lifecycle_stage: 'customer' },
      _sum: { total_revenue: true },
    });
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = await this.prisma.contacts.count({
      where: { deleted_at: null, lifecycle_stage: 'customer', created_at: { gte: startOfMonth } },
    });
    const totalRevenue = Number(revenue._sum.total_revenue || 0);
    return {
      total,
      totalRevenue,
      avgRevenue: total ? totalRevenue / total : 0,
      newThisMonth,
      activeCustomers,
    };
  }

  @Get('agents')
  async agents(@Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    const agents = await this.prisma.contacts.findMany({
      where: {
        deleted_at: null,
        OR: [{ commission_type: { not: 'none' } }, { companies_companies_agent_idTocontacts: { some: {} } }],
      },
      include: {
        companies_contacts_company_idTocompanies: { select: { id: true, name: true } },
        profiles: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: agents.map((a) => this.mapContact(a)),
    };
  }

  @Get(':id/clients')
  async clients(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    const companies = await this.prisma.companies.findMany({
      where: { agent_id: id, deleted_at: null },
      select: { id: true, name: true, email: true, phone: true, total_revenue: true, lifecycle_stage: true, created_at: true },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: companies.map((c) => ({
        ...c,
        total_revenue: Number(c.total_revenue || 0),
      })),
    };
  }

  @Put(':id/commission')
  async updateCommission(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { commission_type: 'none' | 'percentage' | 'fixed_amount'; commission_rate?: number },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    await this.prisma.contacts.update({
      where: { id },
      data: {
        commission_type: body.commission_type as any,
        commission_rate: body.commission_rate ?? 0,
      },
    });

    return {
      success: true,
      data: {
        commission_type: body.commission_type,
        commission_rate: body.commission_rate ?? 0,
      },
    };
  }

  private mapContact(c: any) {
    const company = c.companies_contacts_company_idTocompanies;
    const owner = c.profiles;
    return {
      ...c,
      company: company ? { id: company.id, name: company.name } : null,
      owner: owner ? { id: owner.id, name: `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email } : null,
      total_revenue: Number(c.total_revenue || 0),
      lead_score: c.lead_score ?? 0,
    };
  }
}
