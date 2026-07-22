import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDealDto,
  UpdateDealDto,
  MoveDealDto,
  WonDealDto,
  LostDealDto,
  BulkUpdateDealsDto,
  BulkDeleteDealsDto,
  CreateProjectFromDealDto,
} from './dto';
import { asJsonInput, buildLegacyList, safeDate, toNumber } from './crm-utils';
import { CacheService } from '../redis/cache.service';

@Injectable()
export class DealsService {
  constructor(
    private prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('deals', ...parts) ?? `deals:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  async findAll(query: {
    pipeline_id?: number;
    stage_id?: number;
    status?: 'open' | 'won' | 'lost';
    owner_id?: number;
    company_id?: number;
    contact_id?: number;
    search?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    return this.cached(this.cacheKey('list', JSON.stringify(query)), async () => {
    const {
      pipeline_id,
      stage_id,
      status,
      owner_id,
      company_id,
      contact_id,
      search,
      priority,
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = query;

    const where: { [key: string]: unknown } = { deleted_at: null };
    if (pipeline_id) where.pipeline_id = pipeline_id;
    if (stage_id) where.stage_id = stage_id;
    if (status) where.status = status;
    if (owner_id) where.owner_id = owner_id;
    if (company_id) where.company_id = company_id;
    if (contact_id) where.contact_id = contact_id;
    if (priority) where.priority = priority;
    if (search) {
      (where as { OR: unknown[] }).OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { deal_number: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: { [key: string]: 'asc' | 'desc' } = {
      [sortBy || 'created_at']: sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [deals, total] = await Promise.all([
      this.prisma.deals.findMany({
        where,
        include: {
          crm_pipeline_stages: true,
          crm_pipelines: true,
          contacts: { select: { id: true, name: true, email: true, phone: true } },
          companies: { select: { id: true, name: true, logo_url: true } },
        },
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.deals.count({ where }),
    ]);

    return buildLegacyList('deals', deals, total, page, limit);
    });
  }

  async findOne(id: number) {
    return this.cached(this.cacheKey('detail', id), async () => {
    const deal = await this.prisma.deals.findUnique({
      where: { id },
      include: {
        crm_pipeline_stages: true,
        crm_pipelines: true,
        contacts: { select: { id: true, name: true, email: true, phone: true } },
        companies: { select: { id: true, name: true, logo_url: true } },
        crm_deal_contacts: { include: { contacts: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    const owner = deal.owner_id
      ? await this.prisma.profiles.findUnique({ where: { id: deal.owner_id }, select: { id: true, first_name: true, last_name: true, avatar: true } })
      : null;
    const mapped = {
      ...deal,
      value: toNumber(deal.value),
      stage: deal.crm_pipeline_stages,
      pipeline: deal.crm_pipelines,
      contact: deal.contacts,
      company: deal.companies,
      owner,
      contactAssociations: deal.crm_deal_contacts?.map((dc: any) => ({ contact: dc.contacts })) ?? [],
    };
    return { deal: mapped };
    });
  }

  async getRelated(id: number) {
    const dealResult = await this.findOne(id);
    const deal = dealResult.deal;

    const [activities, notes, stageHistory, projects, expenses, invoices] = await Promise.all([
      this.prisma.crm_activities.findMany({
        where: { deal_id: id },
        include: {
          profiles_crm_activities_owner_idToprofiles: { select: { id: true, first_name: true, last_name: true } },
          profiles_crm_activities_assigned_toToprofiles: { select: { id: true, first_name: true, last_name: true } },
          profiles_crm_activities_created_byToprofiles: { select: { id: true, first_name: true, last_name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      this.prisma.crm_notes.findMany({
        where: { deal_id: id },
        include: { profiles: { select: { id: true, first_name: true, last_name: true } } },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      this.prisma.crm_deal_stage_history.findMany({
        where: { deal_id: id },
        include: {
          crm_pipeline_stages_crm_deal_stage_history_from_stage_idTocrm_pipeline_stages: { select: { id: true, name: true } },
          crm_pipeline_stages_crm_deal_stage_history_to_stage_idTocrm_pipeline_stages: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      this.prisma.crm_projects.findMany({
        where: { deal_id: id, deleted_at: null },
        select: { id: true, name: true, project_number: true, status: true, progress_percentage: true, budget: true, currency: true, start_date: true, due_date: true },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      this.prisma.expenses.findMany({
        where: { deal_id: id },
        select: { id: true, description: true, total_amount: true, currency: true, expense_date: true, category: true, status: true },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      this.prisma.invoices.findMany({
        where: { deal_id: id, deleted_at: null },
        select: { id: true, title: true, package_code: true, total_amount: true, currency: true, status: true, issue_date: true, payment_status: true },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
    ]);

    return {
      deal,
      activities: activities.map((a: any) => ({
        ...a,
        owner: a.profiles_crm_activities_owner_idToprofiles,
        assignee: a.profiles_crm_activities_assigned_toToprofiles,
        creator: a.profiles_crm_activities_created_byToprofiles,
      })),
      notes: notes.map((n: any) => ({ ...n, creator: n.profiles })),
      stageHistory: stageHistory.map((h: any) => ({
        ...h,
        fromStage: h.crm_pipeline_stages_crm_deal_stage_history_from_stage_idTocrm_pipeline_stages,
        toStage: h.crm_pipeline_stages_crm_deal_stage_history_to_stage_idTocrm_pipeline_stages,
      })),
      projects,
      expenses: expenses.map((e: any) => ({ ...e, amount: toNumber(e.total_amount), date: e.expense_date })),
      invoices: invoices.map((i: any) => ({ ...i, total_amount: toNumber(i.total_amount) })),
    };
  }

  async create(userId: number, dto: CreateDealDto) {
    const stage = await this.prisma.crm_pipeline_stages.findUnique({
      where: { id: dto.stage_id },
    });
    if (!stage || stage.pipeline_id !== dto.pipeline_id) {
      throw new BadRequestException('Invalid stage for this pipeline');
    }

    const value = typeof dto.value === 'string' ? parseFloat(dto.value) || 0 : Number(dto.value ?? 0);

    const deal = await this.prisma.deals.create({
      data: {
        deal_number: `DEAL-${Date.now()}`,
        title: dto.title,
        description: dto.description,
        value,
        currency: dto.currency || 'AUD',
        pipeline_id: dto.pipeline_id,
        stage_id: dto.stage_id,
        contact_id: dto.contact_id,
        company_id: dto.company_id,
        owner_id: dto.owner_id || userId,
        expected_close_date: safeDate(dto.expected_close_date),
        lead_source: dto.lead_source,
        priority: (dto.priority || 'medium'),
        status: 'open',
        probability: stage.probability ?? 0,
        custom_fields: asJsonInput(dto.custom_fields),
        tags: asJsonInput(dto.tags),
      },
    });

    await this.prisma.crm_deal_stage_history.create({
      data: {
        deal_id: deal.id,
        from_stage_id: null,
        to_stage_id: dto.stage_id,
        changed_by: userId,
        note: 'Deal created',
      },
    });

    if (dto.contact_id) {
      await this.prisma.crm_deal_contacts.upsert({
        where: {
          deal_id_contact_id: { deal_id: deal.id, contact_id: dto.contact_id },
        },
        create: { deal_id: deal.id, contact_id: dto.contact_id, is_primary: true },
        update: { is_primary: true },
      });
    }

    await this.invalidateCache();
    return this.findOne(deal.id);
  }

  async update(id: number, dto: UpdateDealDto) {
    const existing = await this.prisma.deals.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Deal not found');

    const data = this.buildUpdateData(dto, existing);
    await this.prisma.deals.update({
      where: { id },
      data: data,
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return this.findOne(id);
  }

  async move(id: number, dto: MoveDealDto, userId: number) {
    const deal = await this.prisma.deals.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');

    const oldStageId = deal.stage_id;
    const stage = await this.prisma.crm_pipeline_stages.findUnique({
      where: { id: dto.stage_id },
    });
    if (!stage || stage.pipeline_id !== deal.pipeline_id) {
      throw new BadRequestException('Invalid stage for this pipeline');
    }

    const updateData: Record<string, unknown> = { stage_id: dto.stage_id, stage_entered_at: new Date() };
    if (dto.position !== undefined) updateData.position = dto.position;
    if (stage.probability !== undefined) updateData.probability = stage.probability;

    if (stage.is_won) {
      updateData.status = 'won';
      updateData.actual_close_date = new Date();
    } else if (stage.is_lost) {
      updateData.status = 'lost';
      updateData.actual_close_date = new Date();
    } else {
      updateData.status = 'open';
    }

    await this.prisma.deals.update({
      where: { id },
      data: updateData,
    });

    if (oldStageId !== dto.stage_id) {
      await this.prisma.crm_deal_stage_history.create({
        data: {
          deal_id: id,
          from_stage_id: oldStageId,
          to_stage_id: dto.stage_id,
          changed_by: userId,
          note: 'Deal moved',
        },
      });
    }

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return this.findOne(id);
  }

  async won(id: number, dto: WonDealDto, userId: number) {
    const deal = await this.prisma.deals.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');

    const wonStage = await this.prisma.crm_pipeline_stages.findFirst({
      where: { pipeline_id: deal.pipeline_id, is_won: true, is_active: true },
      orderBy: { position: 'asc' },
    });

    if (!wonStage) throw new BadRequestException('No won stage defined for this pipeline');

    const now = new Date();
    await this.prisma.deals.update({
      where: { id },
      data: {
        status: 'won',
        stage_id: wonStage.id,
        actual_close_date: now,
        won_reason: dto.won_reason,
        probability: 100,
      },
    });

    await this.prisma.crm_deal_stage_history.create({
      data: {
        deal_id: id,
        from_stage_id: deal.stage_id,
        to_stage_id: wonStage.id,
        changed_by: userId,
        note: 'Deal marked as won',
      },
    });

    if (deal.company_id) {
      const company = await this.prisma.companies.findUnique({ where: { id: deal.company_id } });
      if (company) {
        await this.prisma.companies.update({
          where: { id: company.id },
          data: {
            total_revenue: (Number(company.total_revenue) || 0) + toNumber(deal.value),
            total_deals: (company.total_deals || 0) + 1,
            lifecycle_stage: 'customer',
          },
        });
      }
    }

    let portalResult = null;
    let contact = null;
    if (deal.contact_id) {
      contact = await this.prisma.contacts.findUnique({ where: { id: deal.contact_id } });
      if (contact) {
        await this.prisma.contacts.update({
          where: { id: contact.id },
          data: {
            total_revenue: (Number(contact.total_revenue) || 0) + toNumber(deal.value),
            lifecycle_stage: 'customer',
            became_customer_at: contact.became_customer_at || now,
          },
        });

        if (dto.create_portal_access !== false) {
          portalResult = await this.createPortalAccount(contact);
        }
      }
    }

    try {
      await this.prisma.crm_leads.create({
        data: {
          name: contact?.name || deal.title,
          email: contact?.email,
          phone: contact?.phone,
          description: deal.description || `Won deal: ${deal.title}`,
          pipeline_id: deal.pipeline_id,
          stage_id: wonStage.id,
          contact_id: deal.contact_id,
          company_id: deal.company_id,
          owner_id: deal.owner_id,
          lead_source: deal.lead_source || 'Deal Conversion',
          estimated_value: toNumber(deal.value),
          status: 'won',
          won_reason: dto.won_reason || 'Deal marked as won',
          actual_close_date: now,
          probability: 100,
          custom_fields: {
            deal_id: deal.id,
            deal_number: deal.deal_number,
            converted_from_deal: true,
            converted_at: now.toISOString(),
          },
          tags: [],
        },
      });
    } catch {
      // Continue even if lead creation fails
    }

    const updatedDeal = await this.findOne(id);

    await this.invalidateCache();
    await this.cache?.delPrefix(this.cache?.key('contacts') ?? 'contacts');
    await this.cache?.delPrefix(this.cache?.key('companies') ?? 'companies');
    await this.cache?.delPrefix(this.cache?.key('leads') ?? 'leads');
    return {
      ...updatedDeal.deal,
      portalAccess: portalResult
        ? {
            created: portalResult.success && !portalResult.alreadyExists,
            alreadyExists: portalResult.alreadyExists || false,
            message: portalResult.message,
          }
        : null,
    };
  }

  async lost(id: number, dto: LostDealDto, userId: number) {
    const deal = await this.prisma.deals.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');

    const lostStage = await this.prisma.crm_pipeline_stages.findFirst({
      where: { pipeline_id: deal.pipeline_id, is_lost: true, is_active: true },
      orderBy: { position: 'asc' },
    });

    const updateData: Record<string, unknown> = {
      status: 'lost',
      lost_reason: dto.lost_reason,
      competitor: dto.competitor,
      probability: 0,
    };
    if (lostStage) updateData.stage_id = lostStage.id;

    await this.prisma.deals.update({
      where: { id },
      data: updateData,
    });

    await this.prisma.crm_deal_stage_history.create({
      data: {
        deal_id: id,
        from_stage_id: deal.stage_id,
        to_stage_id: lostStage?.id || deal.stage_id,
        changed_by: userId,
        note: `Deal marked as lost: ${dto.lost_reason || ''}`,
      },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return this.findOne(id);
  }

  async reopen(id: number, userId: number) {
    const deal = await this.prisma.deals.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');

    const firstStage = await this.prisma.crm_pipeline_stages.findFirst({
      where: { pipeline_id: deal.pipeline_id, is_active: true },
      orderBy: { position: 'asc' },
    });

    if (!firstStage) throw new BadRequestException('Pipeline has no stages');

    await this.prisma.deals.update({
      where: { id },
      data: {
        status: 'open',
        stage_id: firstStage.id,
        actual_close_date: null,
        lost_reason: null,
        won_reason: null,
      },
    });

    await this.prisma.crm_deal_stage_history.create({
      data: {
        deal_id: id,
        from_stage_id: deal.stage_id,
        to_stage_id: firstStage.id,
        changed_by: userId,
        note: 'Deal reopened',
      },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return this.findOne(id);
  }

  async delete(id: number) {
    const deal = await this.prisma.deals.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');

    await this.prisma.deals.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Deal deleted successfully' };
  }

  async bulkUpdate(dto: BulkUpdateDealsDto) {
    const { deal_ids, updates } = dto;
    const updateData = { ...updates, updated_at: new Date() };

    await this.prisma.deals.updateMany({
      where: { id: { in: deal_ids } },
      data: updateData,
    });

    await this.invalidateCache();
    return { message: `${deal_ids.length} deals updated` };
  }

  async bulkDelete(dto: BulkDeleteDealsDto) {
    await this.prisma.deals.updateMany({
      where: { id: { in: dto.deal_ids } },
      data: { deleted_at: new Date() },
    });

    await this.invalidateCache();
    return { message: `${dto.deal_ids.length} deals deleted` };
  }

  async createProjectFromDeal(id: number, dto: CreateProjectFromDealDto, userId: number) {
    const deal = await this.prisma.deals.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');

    const existingProject = await this.prisma.crm_projects.findFirst({ where: { deal_id: id, deleted_at: null } });
    if (existingProject) {
      return { message: 'A project already exists for this deal', project: existingProject };
    }

    const project = await this.prisma.crm_projects.create({
      data: {
        project_number: `PROJ-${Date.now()}`,
        name: dto.name || deal.title,
        description: dto.description || deal.description,
        status: 'not_started',
        currency: deal.currency || 'AUD',
        start_date: safeDate(dto.start_date),
        due_date: safeDate(dto.due_date),
        customer_id: deal.contact_id,
        company_id: deal.company_id,
        deal_id: id,
        manager_id: dto.manager_id || deal.owner_id,
        created_by: userId,
      },
    });

    await this.prisma.deals.update({
      where: { id },
      data: { is_project: true, project_status: 'not_started' },
    });

    await this.invalidateCache();
    await this.cache?.delPrefix(this.cache?.key('projects') ?? 'projects');
    return { data: project };
  }

  async updateValue(id: number, body: { value: number | string }) {
    const deal = await this.prisma.deals.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');

    const value = typeof body.value === 'string' ? parseFloat(body.value) || 0 : Number(body.value ?? 0);
    await this.prisma.deals.update({
      where: { id },
      data: { value },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return this.findOne(id);
  }

  private buildUpdateData(dto: UpdateDealDto, existing: { stage_id?: number | null }) {
    const data: Record<string, unknown> = {};
    const dtoRecord = dto as unknown as Record<string, unknown>;
    const scalarFields = [
      'title',
      'description',
      'currency',
      'pipeline_id',
      'stage_id',
      'contact_id',
      'company_id',
      'owner_id',
      'lead_source',
      'probability',
      'next_activity_date',
      'is_project',
      'project_status',
    ];

    for (const field of scalarFields) {
      if (dtoRecord[field] !== undefined) data[field] = dtoRecord[field];
    }

    if (dto.value !== undefined) {
      data.value = typeof dto.value === 'string' ? parseFloat(dto.value) || 0 : Number(dto.value ?? 0);
    }

    if (dto.expected_close_date !== undefined) {
      data.expected_close_date = safeDate(dto.expected_close_date);
    }

    if (dto.priority !== undefined) {
      data.priority = dto.priority;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (dto.custom_fields !== undefined) data.custom_fields = asJsonInput(dto.custom_fields);
    if (dto.tags !== undefined) data.tags = asJsonInput(dto.tags);

    if (data.stage_id && data.stage_id !== existing.stage_id) {
      // stage change handled in move endpoint; but update probability if needed
    }

    return data;
  }

  private async createPortalAccount(contact: { name?: string | null; email?: string | null; phone?: string | null }) {
    if (!contact.email) return { success: false, alreadyExists: false, message: 'No email' };

    const existingUser = await this.prisma.profiles.findUnique({ where: { email: contact.email } });
    if (existingUser) {
      return { success: true, alreadyExists: true, message: 'User already exists', user: existingUser };
    }

    const user = await this.prisma.profiles.create({
      data: {
        first_name: contact.name?.split(' ')[0] || contact.name || '',
        last_name: contact.name?.split(' ').slice(1).join(' ') || '',
        email: contact.email,
        phone: contact.phone,
        role: 'customer',
        status: 'active',
      },
    });

    return { success: true, alreadyExists: false, message: 'Portal account created', user };
  }
}
