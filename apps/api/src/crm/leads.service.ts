import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma, crm_leads } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  MoveLeadDto,
  WinLeadDto,
  LoseLeadDto,
} from './dto';
import { asJsonInput, buildLegacyList, safeDate, toNumber } from './crm-utils';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    pipeline_id?: number;
    stage_id?: number;
    status?: string;
    owner_id?: number;
    search?: string;
    priority?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const {
      pipeline_id,
      stage_id,
      status = 'open',
      owner_id,
      search,
      priority,
      page = 1,
      limit = 50,
      sort = 'created_at',
      order = 'DESC',
    } = query;

    const where: { [key: string]: unknown } = {};
    if (pipeline_id) where.pipeline_id = pipeline_id;
    if (stage_id) where.stage_id = stage_id;
    if (status && status !== 'all') where.status = status;
    if (owner_id) where.owner_id = owner_id;
    if (priority) where.priority = priority;
    if (search) {
      (where as { OR: unknown[] }).OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company_name: { contains: search, mode: 'insensitive' } },
        { lead_number: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: { [key: string]: 'asc' | 'desc' } = {
      [sort || 'created_at']: order?.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [leads, total] = await Promise.all([
      this.prisma.crm_leads.findMany({
        where,
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.crm_leads.count({ where }),
    ]);

    const enriched = await Promise.all(leads.map((l) => this.enrichLead(l)));

    return buildLegacyList('leads', enriched, total, page, limit);
  }

  async findOne(id: number) {
    const lead = await this.prisma.crm_leads.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return { lead: await this.enrichLead(lead) };
  }

  async create(userId: number, dto: CreateLeadDto) {
    const stage = await this.prisma.crm_pipeline_stages.findUnique({
      where: { id: dto.stage_id },
    });
    if (!stage || stage.pipeline_id !== dto.pipeline_id) {
      throw new BadRequestException('Invalid stage for this pipeline');
    }

    const value = typeof dto.estimated_value === 'string' ? parseFloat(dto.estimated_value) || 0 : Number(dto.estimated_value ?? 0);

    const lead = await this.prisma.crm_leads.create({
      data: {
        lead_number: `LEAD-${Date.now()}`,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        company_name: dto.company_name,
        job_title: dto.job_title,
        website: dto.website,
        description: dto.description,
        requirements: dto.requirements,
        pipeline_id: dto.pipeline_id,
        stage_id: dto.stage_id,
        position: 0,
        owner_id: dto.owner_id || userId,
        contact_id: dto.contact_id,
        company_id: dto.company_id,
        estimated_value: value,
        currency: dto.currency || 'AUD',
        probability: dto.probability ?? stage.probability ?? 0,
        lead_score: dto.lead_score || this.defaultLeadScore(dto.priority),
        lead_source: dto.lead_source,
        priority: dto.priority || 'medium',
        status: 'open',
        expected_close_date: safeDate(dto.expected_close_date),
        custom_fields: asJsonInput(dto.custom_fields),
        tags: asJsonInput(dto.tags),
      },
    });

    return { message: 'Lead created successfully', lead: await this.enrichLead(lead) };
  }

  async update(id: number, dto: UpdateLeadDto) {
    const lead = await this.prisma.crm_leads.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const data = this.buildUpdateData(dto);
    await this.prisma.crm_leads.update({
      where: { id },
      data: data,
    });

    return { message: 'Lead updated successfully', lead: await this.findOne(id) };
  }

  async move(id: number, dto: MoveLeadDto) {
    const lead = await this.prisma.crm_leads.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const stage = dto.stage_id
      ? await this.prisma.crm_pipeline_stages.findUnique({ where: { id: dto.stage_id } })
      : null;
    if (stage && stage.pipeline_id !== lead.pipeline_id) {
      throw new BadRequestException('Invalid stage for this pipeline');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.stage_id) updateData.stage_id = dto.stage_id;
    if (dto.position !== undefined) updateData.position = dto.position;

    await this.prisma.crm_leads.update({
      where: { id },
      data: updateData,
    });

    return { message: 'Lead moved successfully', lead: await this.findOne(id) };
  }

  async win(id: number, dto: WinLeadDto, userId: number) {
    const lead = await this.prisma.crm_leads.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const wonStage = await this.prisma.crm_pipeline_stages.findFirst({
      where: { pipeline_id: lead.pipeline_id, is_won: true, is_active: true },
      orderBy: { position: 'asc' },
    });
    if (!wonStage) throw new BadRequestException('No won stage defined');

    const now = new Date();
    const contactName = lead.name || 'New Customer';

    const contact = await this.prisma.contacts.create({
      data: {
        name: contactName,
        email: lead.email || `lead-${lead.id}@placeholder.com`,
        phone: lead.phone,
        subject: '',
        message: `Converted from lead ${lead.lead_number}`,
        company: lead.company_name,
        job_title: lead.job_title,
        website: lead.website,
        lifecycle_stage: 'customer',
        lead_status: 'qualified',
        became_customer_at: now,
        company_id: lead.company_id,
        owner_id: lead.owner_id,
      },
    });

    await this.prisma.crm_leads.update({
      where: { id },
      data: {
        status: 'won',
        stage_id: wonStage.id,
        converted_contact_id: contact.id,
        actual_close_date: now,
        won_reason: dto.reason || 'Lead marked as won',
        probability: 100,
      },
    });

    let deal = null;
    if (dto.create_deal) {
      const value = typeof lead.estimated_value === 'number' ? lead.estimated_value : Number(lead.estimated_value ?? 0);
      deal = await this.prisma.deals.create({
        data: {
          deal_number: `DEAL-${Date.now()}`,
          title: dto.deal_title || `Deal for ${lead.name}`,
          description: `Created from won lead: ${lead.lead_number}`,
          value,
          currency: lead.currency || 'AUD',
          pipeline_id: lead.pipeline_id,
          stage_id: wonStage.id,
          contact_id: contact.id,
          company_id: lead.company_id,
          owner_id: lead.owner_id || userId,
          lead_source: lead.lead_source || 'lead_conversion',
          status: 'open',
        } as unknown as Prisma.dealsUncheckedCreateInput,
      });

      await this.prisma.crm_deal_stage_history.create({
        data: {
          deal_id: deal.id,
          from_stage_id: null,
          to_stage_id: wonStage.id,
          changed_by: userId,
          note: 'Deal created from won lead',
        },
      });

      await this.prisma.crm_deal_contacts.create({
        data: { deal_id: deal.id, contact_id: contact.id, is_primary: true },
      });
    }

    return {
      message: 'Lead won and converted to customer',
      lead: await this.findOne(id),
      customer: contact,
      deal,
    };
  }

  async lose(id: number, dto: LoseLeadDto) {
    const lead = await this.prisma.crm_leads.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const lostStage = await this.prisma.crm_pipeline_stages.findFirst({
      where: { pipeline_id: lead.pipeline_id, is_lost: true, is_active: true },
      orderBy: { position: 'asc' },
    });

    await this.prisma.crm_leads.update({
      where: { id },
      data: {
        status: 'lost',
        stage_id: lostStage?.id || lead.stage_id,
        lost_reason: dto.reason,
        competitor: dto.competitor,
        probability: 0,
      },
    });

    return { message: 'Lead marked as lost', lead: await this.findOne(id) };
  }

  async delete(id: number) {
    const lead = await this.prisma.crm_leads.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    await this.prisma.crm_leads.delete({ where: { id } });
    return { message: 'Lead deleted successfully' };
  }

  async getByPipeline(pipelineId: number, status?: string) {
    const pipeline = await this.prisma.crm_pipelines.findUnique({
      where: { id: pipelineId },
      include: { crm_pipeline_stages: { where: { is_active: true }, orderBy: { position: 'asc' } } },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    if (pipeline.crm_pipeline_stages.length === 0) {
      return {
        pipeline: { id: pipeline.id, name: pipeline.name, currency: pipeline.currency },
        stages: [],
        stats: { totalLeads: 0, totalDeals: 0, totalValue: 0, weightedValue: 0 },
      };
    }

    const stageIds = pipeline.crm_pipeline_stages.map((s) => s.id);

    const allLeads = await this.prisma.crm_leads.findMany({
      where: { stage_id: { in: stageIds } },
      orderBy: [{ position: 'asc' }, { created_at: 'desc' }],
    });

    const allDeals = await this.prisma.deals.findMany({
      where: { stage_id: { in: stageIds }, pipeline_id: pipelineId, deleted_at: null },
      orderBy: [{ position: 'asc' }, { created_at: 'desc' }],
    });

    const enrichedLeads = await Promise.all(allLeads.map((l) => this.enrichLead(l)));

    const stages = pipeline.crm_pipeline_stages.map((stage) => {
      let statusFilter: string | null = null;
      if (status && status !== 'all') {
        statusFilter = status;
      } else {
        if (stage.is_won) statusFilter = 'won';
        else if (stage.is_lost) statusFilter = 'lost';
        else statusFilter = 'open';
      }

      const stageLeads = enrichedLeads
        .filter((l: { stage_id: number; status: string | null }) => l.stage_id === stage.id && (!statusFilter || l.status === statusFilter))
        .map((l) => ({ ...l, type: 'lead' }));

      const stageDeals = allDeals
        .filter((d) => d.stage_id === stage.id && (!statusFilter || d.status === statusFilter))
        .map((d) => ({ ...d, type: 'deal' }));

      return { ...stage, leads: stageLeads, deals: stageDeals };
    });

    const totalLeads = stages.reduce((sum, s) => sum + ((s.leads as unknown[]).length || 0), 0);
    const totalDeals = stages.reduce((sum, s) => sum + ((s.deals as unknown[]).length || 0), 0);
    const totalValue = stages.reduce((sum, s) => {
      const leadValue = (s.leads as Array<{ estimated_value?: unknown }>).reduce((a, l) => a + toNumber(l.estimated_value), 0);
      const dealValue = (s.deals as Array<{ value?: unknown }>).reduce((a, d) => a + toNumber(d.value), 0);
      return sum + leadValue + dealValue;
    }, 0);

    return {
      pipeline: { id: pipeline.id, name: pipeline.name, currency: pipeline.currency },
      stages,
      stats: { totalLeads, totalDeals, totalValue, weightedValue: totalValue },
    };
  }

  async getHot(page = 1, limit = 50) {
    const where = {
      lead_score: { gte: 70 },
      status: 'open',
    };

    const [leads, total] = await Promise.all([
      this.prisma.crm_leads.findMany({ where, take: limit, skip: (page - 1) * limit }),
      this.prisma.crm_leads.count({ where }),
    ]);

    const enriched = await Promise.all(leads.map((l) => this.enrichLead(l)));
    return buildLegacyList('leads', enriched, total, page, limit);
  }

  async getUncontacted(page = 1, limit = 50) {
    const where = {
      last_activity_at: null,
      status: 'open',
    };

    const [leads, total] = await Promise.all([
      this.prisma.crm_leads.findMany({ where, take: limit, skip: (page - 1) * limit }),
      this.prisma.crm_leads.count({ where }),
    ]);

    const enriched = await Promise.all(leads.map((l) => this.enrichLead(l)));
    return buildLegacyList('leads', enriched, total, page, limit);
  }

  async getByStage(stageId: number, page = 1, limit = 50) {
    const [leads, total] = await Promise.all([
      this.prisma.crm_leads.findMany({ where: { stage_id: stageId }, take: limit, skip: (page - 1) * limit }),
      this.prisma.crm_leads.count({ where: { stage_id: stageId } }),
    ]);

    const enriched = await Promise.all(leads.map((l) => this.enrichLead(l)));
    return buildLegacyList('leads', enriched, total, page, limit);
  }

  async recalculateScores() {
    const leads = await this.prisma.crm_leads.findMany();
    const updates = leads.map((lead) => {
      const score = this.calculateLeadScore(lead);
      return this.prisma.crm_leads.update({
        where: { id: lead.id },
        data: { lead_score: score },
      });
    });

    await this.prisma.$transaction(updates as Prisma.PrismaPromise<unknown>[]);

    return { message: `Recalculated scores for ${updates.length} leads` };
  }

  async autoAssign() {
    const managers = await this.prisma.profiles.findMany({
      where: { role: 'manager', status: 'active' },
      select: { id: true },
    });

    if (managers.length === 0) return { message: 'No managers available for auto-assignment' };

    const unassigned = await this.prisma.crm_leads.findMany({
      where: { owner_id: null, status: 'open' },
    });

    let index = 0;
    const updates = unassigned.map((lead) => {
      const manager = managers[index % managers.length];
      index++;
      return this.prisma.crm_leads.update({
        where: { id: lead.id },
        data: { owner_id: manager.id },
      });
    });

    await this.prisma.$transaction(updates as Prisma.PrismaPromise<unknown>[]);

    return { message: `Auto-assigned ${updates.length} leads` };
  }

  private buildUpdateData(dto: UpdateLeadDto) {
    const dtoRecord = dto as unknown as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    const scalarFields = [
      'name',
      'email',
      'phone',
      'company_name',
      'job_title',
      'website',
      'description',
      'requirements',
      'pipeline_id',
      'stage_id',
      'owner_id',
      'contact_id',
      'company_id',
      'probability',
      'lead_score',
      'lead_source',
      'priority',
      'status',
      'won_reason',
      'lost_reason',
      'competitor',
      'currency',
    ];

    for (const field of scalarFields) {
      if (dtoRecord[field] !== undefined) data[field] = dtoRecord[field];
    }

    if (dto.estimated_value !== undefined) {
      data.estimated_value = typeof dto.estimated_value === 'string' ? parseFloat(dto.estimated_value) || 0 : Number(dto.estimated_value ?? 0);
    }
    if (dto.expected_close_date !== undefined) {
      data.expected_close_date = safeDate(dto.expected_close_date);
    }
    if (dto.custom_fields !== undefined) data.custom_fields = asJsonInput(dto.custom_fields);
    if (dto.tags !== undefined) data.tags = asJsonInput(dto.tags);

    return data;
  }

  private async enrichLead(lead: crm_leads) {
    const owner = lead.owner_id
      ? await this.prisma.profiles.findUnique({
          where: { id: lead.owner_id },
          select: { id: true, first_name: true, last_name: true, avatar: true },
        })
      : null;

    const company = lead.company_id
      ? await this.prisma.companies.findUnique({
          where: { id: lead.company_id },
          select: { id: true, name: true, logo_url: true },
        })
      : null;

    const contact = lead.contact_id
      ? await this.prisma.contacts.findUnique({
          where: { id: lead.contact_id },
          select: { id: true, name: true, email: true, phone: true },
        })
      : null;

    const convertedContact = lead.converted_contact_id
      ? await this.prisma.contacts.findUnique({
          where: { id: lead.converted_contact_id },
          select: { id: true, name: true, email: true },
        })
      : null;

    const stage = await this.prisma.crm_pipeline_stages.findUnique({
      where: { id: lead.stage_id },
    });

    return {
      ...lead,
      stage_id: lead.stage_id,
      status: lead.status,
      owner,
      company,
      contact,
      converted_contact: convertedContact,
      stage,
      estimated_value: toNumber(lead.estimated_value),
      probability: lead.probability ?? 0,
    };
  }

  private calculateLeadScore(lead: { email?: string | null; phone?: string | null; company_name?: string | null; website?: string | null; lead_source?: string | null; priority?: string | null }) {
    let score = 0;
    if (lead.email) score += 10;
    if (lead.phone) score += 10;
    if (lead.company_name) score += 15;
    if (lead.website) score += 10;
    if (lead.lead_source) score += 5;
    if (lead.priority === 'high') score += 25;
    if (lead.priority === 'urgent') score += 35;
    return Math.min(100, score);
  }

  private defaultLeadScore(priority?: string) {
    switch (priority) {
      case 'urgent': return 60;
      case 'high': return 50;
      case 'medium': return 35;
      case 'low': return 20;
      default: return 35;
    }
  }
}
