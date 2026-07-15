import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateContactDto,
  UpdateContactDto,
  UpdateLeadScoreDto,
  UpdateLifecycleStageDto,
  LinkContactCompanyDto,
  ConvertToDealDto,
  PortalAccessBatchDto,
} from './dto';
import { buildLegacyList, safeDate, toNumber } from './crm-utils';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    query: {
      search?: string;
      lifecycle_stage?: string;
      status?: string;
      owner_id?: number;
      assigned_to?: number;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    },
  ) {
    const {
      search,
      lifecycle_stage,
      status,
      owner_id,
      assigned_to,
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = query;

    const where: { [key: string]: unknown } = {};
    if (lifecycle_stage) where.lifecycle_stage = lifecycle_stage;
    if (status) where.status = status;
    if (owner_id) where.owner_id = owner_id;
    if (assigned_to) where.assigned_to = assigned_to;
    if (search) {
      (where as { OR: unknown[] }).OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: { [key: string]: 'asc' | 'desc' } = {
      [sortBy || 'created_at']: sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [contacts, total] = await Promise.all([
      this.prisma.contacts.findMany({
        where,
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.contacts.count({ where }),
    ]);

    const withCompanies = await this.enrichContacts(contacts);

    return buildLegacyList('contacts', withCompanies, total, page, limit);
  }

  async findOne(id: number) {
    const contact = await this.prisma.contacts.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return { data: await this.enrichContact(contact) };
  }

  async create(dto: CreateContactDto) {
    const contact = await this.prisma.contacts.create({
      data: this.buildCreateData(dto) as unknown as Prisma.contactsUncheckedCreateInput,
    });

    if (dto.company_id) {
      await this.upsertContactCompany(contact.id, dto.company_id, true);
    }

    return this.findOne(contact.id);
  }

  async update(id: number, dto: UpdateContactDto) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');

    await this.prisma.contacts.update({
      where: { id },
      data: this.buildUpdateData(dto, existing as unknown as Record<string, unknown>),
    });

    if (dto.company_id) {
      await this.upsertContactCompany(id, dto.company_id, true);
    }

    return this.findOne(id);
  }

  async delete(id: number) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    await this.prisma.contacts.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { message: 'Contact deleted successfully' };
  }

  async getInvoices(id: number, status?: string, type?: string, page = 1, limit = 20) {
    await this.ensureContactExists(id);
    const where: { source_type?: string; source_id?: number; status?: string; type?: string } = {
      source_type: 'contact',
      source_id: id,
    };
    if (status && status !== 'all') where.status = status;
    if (type && status !== 'all') where.type = type;

    const [invoices, total] = await Promise.all([
      this.prisma.invoices.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.invoices.count({ where }),
    ]);

    const serialized = invoices.map((inv) => ({
      ...inv,
      invoice_number: inv.package_code || inv.id,
    }));

    return buildLegacyList('invoices', serialized, total, page, limit);
  }

  async getPayments(id: number, status?: string, page = 1, limit = 20) {
    await this.ensureContactExists(id);
    const invoices = await this.prisma.invoices.findMany({
      where: { source_type: 'contact', source_id: id },
      select: { id: true },
    });
    const invoiceIds = invoices.map((i) => i.id);

    if (invoiceIds.length === 0) {
      return buildLegacyList('payments', [], 0, page, limit);
    }

    const where: { invoice_id: { in: number[] }; status?: string } = { invoice_id: { in: invoiceIds } };
    if (status && status !== 'all') where.status = status;

    const [payments, total] = await Promise.all([
      this.prisma.payments.findMany({
        where,
        include: { invoices: true },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.payments.count({ where }),
    ]);

    return buildLegacyList('payments', payments, total, page, limit);
  }

  async getPortalAccess(id: number) {
    await this.ensureContactExists(id);
    const contact = await this.prisma.contacts.findUnique({
      where: { id },
      select: { email: true, user_id: true },
    });
    const user = contact?.email
      ? await this.prisma.profiles.findUnique({ where: { email: contact.email } })
      : null;

    return {
      hasAccess: Boolean(user?.id),
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      linkType: user ? 'linked' : 'none',
    };
  }

  async createPortalAccess(id: number) {
    await this.ensureContactExists(id);
    const contact = await this.prisma.contacts.findUnique({ where: { id } });
    if (!contact?.email) {
      throw new BadRequestException('Contact has no email');
    }

    const existingUser = await this.prisma.profiles.findUnique({
      where: { email: contact.email },
    });

    if (existingUser) {
      if (!contact.user_id) {
        await this.prisma.contacts.update({
          where: { id },
          data: { user_id: existingUser.id },
        });
      }
      return {
        success: true,
        alreadyExists: true,
        message: 'Contact already has portal access',
        user: existingUser,
      };
    }

    const user = await this.prisma.profiles.create({
      data: {
        first_name: contact.name?.split(' ')[0] || contact.name,
        last_name: contact.name?.split(' ').slice(1).join(' ') || '',
        email: contact.email,
        phone: contact.phone,
        role: 'customer',
        status: 'active',
      },
    });

    await this.prisma.contacts.update({
      where: { id },
      data: { user_id: user.id, lifecycle_stage: 'customer' },
    });

    return {
      success: true,
      alreadyExists: false,
      message: 'Portal account created',
      user,
    };
  }

  async resendPortalEmail(id: number) {
    await this.ensureContactExists(id);
    const result = await this.createPortalAccess(id);
    return {
      success: result.success,
      alreadyExists: result.alreadyExists,
      message: result.alreadyExists ? 'Portal access already exists' : 'Portal invitation resent',
    };
  }

  async batchPortalAccess(dto: PortalAccessBatchDto) {
    const results: unknown[] = [];
    for (const id of dto.contact_ids) {
      try {
        const r = await this.createPortalAccess(id);
        results.push({ contact_id: id, success: r.success, alreadyExists: r.alreadyExists });
      } catch (e) {
        results.push({ contact_id: id, success: false, error: (e as Error).message });
      }
    }
    return { processed: results.length, results };
  }

  async getWithPortalStatus(
    query: {
      search?: string;
      has_portal_access?: string;
      lifecycle_stage?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const { search, has_portal_access, lifecycle_stage, status, page = 1, limit = 50 } = query;

    const where: { [key: string]: unknown } = {};
    if (lifecycle_stage) where.lifecycle_stage = lifecycle_stage;
    if (status) where.status = status;
    if (search) {
      (where as { OR: unknown[] }).OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const contacts = await this.prisma.contacts.findMany({ where });
    const enriched = await this.enrichContacts(contacts);

    let filtered = enriched;
    if (has_portal_access === 'true') {
      filtered = filtered.filter((c: { portalAccess: { hasAccess: boolean } }) => c.portalAccess.hasAccess);
    } else if (has_portal_access === 'false') {
      filtered = filtered.filter((c: { portalAccess: { hasAccess: boolean } }) => !c.portalAccess.hasAccess);
    }

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return buildLegacyList('contacts', paginated, total, page, limit);
  }

  async getStats(ownerId?: number) {
    const baseWhere = ownerId ? { owner_id: ownerId } : {};

    const [total, customerCount, leadCount, mqlCount, sqlCount, subscriberCount] = await Promise.all([
      this.prisma.contacts.count({ where: baseWhere }),
      this.prisma.contacts.count({ where: { ...baseWhere, lifecycle_stage: 'customer' } }),
      this.prisma.contacts.count({ where: { ...baseWhere, lifecycle_stage: 'lead' } }),
      this.prisma.contacts.count({ where: { ...baseWhere, lifecycle_stage: 'marketing_qualified' } }),
      this.prisma.contacts.count({ where: { ...baseWhere, lifecycle_stage: 'sales_qualified' } }),
      this.prisma.contacts.count({ where: { ...baseWhere, lifecycle_stage: 'subscriber' } }),
    ]);

    const avgLeadScore = await this.prisma.$queryRawUnsafe<[{ avg: unknown }]>(
      `
      SELECT AVG(lead_score)::numeric AS avg
      FROM contacts
      WHERE ${ownerId ? 'owner_id = $1' : '1=1'} AND deleted_at IS NULL
      `,
      ...(ownerId ? [ownerId] : []),
    );

    return {
      total,
      customerCount,
      leadCount,
      mql: mqlCount,
      sql: sqlCount,
      subscriber: subscriberCount,
      avgLeadScore: toNumber(avgLeadScore[0]?.avg) || 0,
    };
  }

  async updateLeadScore(id: number, dto: UpdateLeadScoreDto) {
    const contact = await this.prisma.contacts.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');

    let leadScore = contact.lead_score ?? 0;
    if (dto.recalculate) {
      leadScore = this.calculateLeadScore(contact);
    } else if (dto.lead_score !== undefined) {
      leadScore = Math.max(0, Math.min(100, dto.lead_score));
    }

    await this.prisma.contacts.update({
      where: { id },
      data: { lead_score: leadScore },
    });

    return { lead_score: leadScore };
  }

  async updateLifecycleStage(id: number, dto: UpdateLifecycleStageDto) {
    const contact = await this.prisma.contacts.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');

    const updateData: Record<string, unknown> = { lifecycle_stage: dto.lifecycle_stage };
    if (dto.lifecycle_stage === 'customer' && !contact.became_customer_at) {
      updateData.became_customer_at = new Date();
    }
    if (dto.lifecycle_stage === 'marketing_qualified' && !contact.became_mql_at) {
      updateData.became_mql_at = new Date();
    }
    if (dto.lifecycle_stage === 'sales_qualified' && !contact.became_sql_at) {
      updateData.became_sql_at = new Date();
    }

    await this.prisma.contacts.update({ where: { id }, data: updateData });
    return this.findOne(id);
  }

  async linkCompany(contactId: number, companyId: number, dto?: LinkContactCompanyDto) {
    await this.ensureContactExists(contactId);
    await this.ensureCompanyExists(companyId);
    await this.upsertContactCompany(contactId, companyId, dto?.is_primary ?? false, dto);
    return { message: 'Company linked to contact' };
  }

  async unlinkCompany(contactId: number, companyId: number) {
    await this.ensureContactExists(contactId);
    await this.prisma.crm_contact_companies.deleteMany({
      where: { contact_id: contactId, company_id: companyId },
    });
    return { message: 'Company unlinked from contact' };
  }

  async convertToDeal(contactId: number, dto: ConvertToDealDto, userId: number) {
    const contact = await this.prisma.contacts.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');

    let pipelineId = dto.pipeline_id;
    let stageId = dto.stage_id;

    if (!pipelineId || !stageId) {
      const defaultPipeline = await this.prisma.crm_pipelines.findFirst({
        where: { is_active: true },
        orderBy: { id: 'asc' },
      });
      if (!defaultPipeline) throw new BadRequestException('No active pipeline found');
      pipelineId = defaultPipeline.id;

      const firstStage = await this.prisma.crm_pipeline_stages.findFirst({
        where: { pipeline_id: pipelineId },
        orderBy: { position: 'asc' },
      });
      if (!firstStage) throw new BadRequestException('Pipeline has no stages');
      stageId = firstStage.id;
    } else {
      const stage = await this.prisma.crm_pipeline_stages.findUnique({ where: { id: stageId } });
      if (!stage || stage.pipeline_id !== pipelineId) {
        throw new BadRequestException('Invalid stage for this pipeline');
      }
    }

    const value = typeof dto.value === 'string' ? parseFloat(dto.value) || 0 : Number(dto.value ?? 0);

    const deal = await this.prisma.deals.create({
      data: {
        deal_number: `DEAL-${Date.now()}`,
        title: dto.title || `Deal for ${contact.name}`,
        description: dto.description || contact.message || '',
        value,
        currency: 'AUD',
        pipeline_id: pipelineId,
        stage_id: stageId,
        contact_id: contact.id,
        company_id: contact.company_id ?? undefined,
        owner_id: userId,
        lead_source: contact.source || 'lead_conversion',
        priority: (contact.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
        status: 'open',
        expected_close_date: safeDate(dto.expected_close_date),
      },
    });

    await this.prisma.crm_deal_stage_history.create({
      data: {
        deal_id: deal.id,
        from_stage_id: null,
        to_stage_id: stageId,
        changed_by: userId,
        note: 'Deal created from lead conversion',
      },
    });

    await this.prisma.crm_deal_contacts.create({
      data: { deal_id: deal.id, contact_id: contact.id, is_primary: true },
    });

    if (contact.lead_status !== 'qualified') {
      await this.prisma.contacts.update({
        where: { id: contact.id },
        data: { lead_status: 'qualified' },
      });
    }

    return {
      message: 'Lead successfully converted to deal',
      deal: { id: deal.id, title: deal.title, pipeline_id: deal.pipeline_id, stage_id: deal.stage_id },
    };
  }

  private buildCreateData(dto: CreateContactDto) {
    const data: Record<string, unknown> = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      subject: dto.subject || '',
      message: dto.message || '',
      contact_type: dto.contact_type || 'general',
      priority: dto.priority || 'medium',
      status: dto.status || 'new',
      assigned_to: dto.assigned_to ?? dto.owner_id,
      owner_id: dto.owner_id,
      company: dto.company,
      website: dto.website,
      location: dto.location,
      source: dto.source,
      job_title: dto.job_title,
      department: dto.department,
      lifecycle_stage: dto.lifecycle_stage || 'subscriber',
      lead_status: dto.lead_status || 'new',
      custom_fields: dto.custom_fields ? JSON.stringify(dto.custom_fields) : null,
      tags: dto.tags ? JSON.stringify(dto.tags) : null,
      company_id: dto.company_id,
      linkedin_url: dto.linkedin_url,
      twitter_url: dto.twitter_url,
      date_of_birth: safeDate(dto.date_of_birth),
      preferred_contact_method: dto.preferred_contact_method || 'email',
      is_demo: dto.is_demo,
    };
    return data;
  }

  private buildUpdateData(dto: UpdateContactDto, existing: { [key: string]: unknown }) {
    const data: Record<string, unknown> = {};
    const dtoRecord = dto as unknown as Record<string, unknown>;
    const fields = [
      'name',
      'email',
      'phone',
      'subject',
      'message',
      'contact_type',
      'priority',
      'status',
      'assigned_to',
      'owner_id',
      'company',
      'website',
      'location',
      'source',
      'job_title',
      'department',
      'lifecycle_stage',
      'lead_status',
      'company_id',
      'linkedin_url',
      'twitter_url',
      'preferred_contact_method',
      'is_demo',
    ];
    for (const field of fields) {
      if (dtoRecord[field] !== undefined) {
        data[field] = dtoRecord[field];
      }
    }

    if (dtoRecord.date_of_birth !== undefined) {
      data.date_of_birth = safeDate(dtoRecord.date_of_birth as string | undefined);
    }
    if (dto.custom_fields !== undefined) {
      data.custom_fields = dto.custom_fields ? JSON.stringify(dto.custom_fields) : null;
    }
    if (dto.tags !== undefined) {
      data.tags = dto.tags ? JSON.stringify(dto.tags) : null;
    }

    if (data.lifecycle_stage && data.lifecycle_stage !== existing.lifecycle_stage) {
      if (data.lifecycle_stage === 'customer' && !existing.became_customer_at) {
        data.became_customer_at = new Date();
      }
      if (data.lifecycle_stage === 'marketing_qualified' && !existing.became_mql_at) {
        data.became_mql_at = new Date();
      }
      if (data.lifecycle_stage === 'sales_qualified' && !existing.became_sql_at) {
        data.became_sql_at = new Date();
      }
    }

    return data;
  }

  private calculateLeadScore(contact: { lead_status?: string | null; lifecycle_stage?: string | null; email_subscribed?: boolean | null; total_revenue?: unknown }) {
    let score = 0;
    if (contact.email_subscribed) score += 10;
    if (contact.lead_status === 'qualified') score += 30;
    if (contact.lifecycle_stage === 'customer') score += 50;
    score += Math.min(30, toNumber(contact.total_revenue) / 1000);
    return Math.min(100, score);
  }

  private async enrichContacts(contacts: any[]) {
    const contactIds = contacts.map((c) => c.id);
    const ownerIds = contacts.map((c) => c.owner_id).filter(Boolean) as number[];
    const emails = contacts.map((c) => c.email).filter(Boolean) as string[];
    const companyIds = contacts.map((c) => c.company_id).filter(Boolean) as number[];

    const [owners, contactCompanies, portalProfiles, companies] = await Promise.all([
      this.prisma.profiles.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, first_name: true, last_name: true, email: true, avatar: true, role: true },
      }),
      this.prisma.crm_contact_companies.findMany({
        where: { contact_id: { in: contactIds } },
        include: { companies: { select: { id: true, name: true, logo_url: true } } },
      }),
      this.prisma.profiles.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true, role: true },
      }),
      companyIds.length ? this.prisma.companies.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true, logo_url: true },
      }) : Promise.resolve([] as any[]),
    ]);

    const ownerMap = new Map(owners.map((o) => [o.id, { ...o, name: `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email }]));
    const portalMap = new Map(portalProfiles.map((p) => [p.email, p]));
    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const contactCompaniesMap = new Map<number, any[]>();
    for (const cc of contactCompanies) {
      if (!contactCompaniesMap.has(cc.contact_id)) contactCompaniesMap.set(cc.contact_id, []);
      contactCompaniesMap.get(cc.contact_id)!.push(cc);
    }

    return contacts.map((contact) => {
      const owner = contact.owner_id ? ownerMap.get(contact.owner_id) || null : null;
      const companyList = contactCompaniesMap.get(contact.id) || [];
      const primaryCompany =
        companyList.find((c) => c.is_primary)?.companies ||
        companyList[0]?.companies ||
        (contact.company_id ? companyMap.get(contact.company_id) || null : null) ||
        null;
      const portalProfile = contact.email ? portalMap.get(contact.email) : undefined;
      const portalAccess = {
        hasAccess: Boolean(portalProfile?.id),
        user: portalProfile ? { id: portalProfile.id, email: portalProfile.email, role: portalProfile.role } : null,
        linkType: portalProfile ? 'linked' : 'none',
      };
      return {
        ...contact,
        owner,
        primary_company: primaryCompany,
        companies: companyList.map((c) => c.companies),
        portalAccess,
        total_revenue: toNumber(contact.total_revenue),
        lead_score: contact.lead_score ?? 0,
      };
    });
  }

  private async enrichContact(contact: { id: number; email?: string | null; owner_id?: number | null; total_revenue?: unknown; lead_score?: number | null }) {
    const enriched = await this.enrichContacts([contact]);
    return enriched[0];
  }

  private async upsertContactCompany(
    contactId: number,
    companyId: number,
    isPrimary: boolean,
    dto?: LinkContactCompanyDto,
  ) {
    const existing = await this.prisma.crm_contact_companies.findFirst({
      where: { contact_id: contactId, company_id: companyId },
    });

    if (existing) {
      await this.prisma.crm_contact_companies.update({
        where: { id: existing.id },
        data: {
          is_primary: isPrimary,
          job_title: dto?.job_title ?? existing.job_title,
          department: dto?.department ?? existing.department,
          is_decision_maker: dto?.is_decision_maker ?? existing.is_decision_maker,
        },
      });
    } else {
      await this.prisma.crm_contact_companies.create({
        data: {
          contact_id: contactId,
          company_id: companyId,
          is_primary: isPrimary,
          job_title: dto?.job_title,
          department: dto?.department,
          is_decision_maker: dto?.is_decision_maker,
        },
      });
    }

    await this.prisma.contacts.update({
      where: { id: contactId },
      data: { company_id: companyId },
    });
  }

  private async ensureContactExists(id: number) {
    const contact = await this.prisma.contacts.findUnique({ where: { id }, select: { id: true } });
    if (!contact) throw new NotFoundException('Contact not found');
  }

  private async ensureCompanyExists(id: number) {
    const company = await this.prisma.companies.findUnique({ where: { id }, select: { id: true } });
    if (!company) throw new NotFoundException('Company not found');
  }
}
