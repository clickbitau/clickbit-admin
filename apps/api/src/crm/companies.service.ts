import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AggregatedStats,
  CompaniesListResponse,
  Company,
  GetCompaniesQueryDto,
  ALLOWED_COMPANY_SORT,
} from '@clickbit/shared';
import type { Prisma, enum_crm_companies_lifecycle_stage } from '@prisma/client';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyDocumentUploadDto,
} from './dto';
import { asJsonInput, buildLegacyList, buildPagination, mapCompanySize, safeDate, toNumber } from './crm-utils';

function toNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (typeof value === 'object' && 'toNumber' in (value)) {
    return (value as { toNumber: () => number }).toNumber() || 0;
  }
  return Number(value) || 0;
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: GetCompaniesQueryDto): Promise<CompaniesListResponse> {
    const {
      search,
      industry,
      lifecycle_stage,
      owner_id,
      page = 1,
      limit = 50,
      sortBy = 'updated_at',
      sortOrder = 'DESC',
      includeStats,
      mode,
    } = query;

    const allowedSorts = new Set<string>(ALLOWED_COMPANY_SORT);
    const safeSortBy = sortBy && allowedSorts.has(sortBy) ? sortBy : 'updated_at';
    const safeSortOrder =
      String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const currentPage = Number(page);
    const itemsPerPage = Math.min(Math.max(Number(limit), 1), 250);
    const offset = (currentPage - 1) * itemsPerPage;

    const conditions: string[] = [
      'c.is_active = true',
      'c.deleted_at IS NULL',
    ];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (lifecycle_stage) {
      conditions.push(`c.lifecycle_stage = $${paramIndex++}`);
      params.push(lifecycle_stage);
    } else {
      conditions.push("c.lifecycle_stage != 'internal'");
    }

    if (industry) {
      conditions.push(`c.industry = $${paramIndex++}`);
      params.push(industry);
    }

    if (owner_id) {
      conditions.push(`c.owner_id = $${paramIndex++}`);
      params.push(owner_id);
    }

    if (search) {
      const escaped = escapeLike(search);
      conditions.push(
        `(c.name ILIKE $${paramIndex} OR c.domain ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex})`,
      );
      params.push(`%${escaped}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const listSql = `
      SELECT
        c.*,
        p.id AS owner_id,
        p.first_name AS owner_first_name,
        p.last_name AS owner_last_name,
        contact.id AS contact_id,
        contact.name AS contact_name,
        contact.email AS contact_email,
        contact.phone AS contact_phone
      FROM companies c
      LEFT JOIN profiles p ON p.id = c.owner_id
      LEFT JOIN LATERAL (
        SELECT ccc_inner.*
        FROM crm_contact_companies ccc_inner
        WHERE ccc_inner.company_id = c.id
          AND ccc_inner.is_primary = true
        ORDER BY ccc_inner.created_at DESC
        LIMIT 1
      ) ccc ON true
      LEFT JOIN contacts contact ON contact.id = ccc.contact_id
      WHERE ${whereClause}
      ORDER BY c.${safeSortBy} ${safeSortOrder}
      LIMIT ${itemsPerPage} OFFSET ${offset}
    `;

    const countSql = `
      SELECT COUNT(DISTINCT c.id)::int AS count
      FROM companies c
      WHERE ${whereClause}
    `;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(listSql, ...params),
      this.prisma.$queryRawUnsafe<Array<{ count: number }>>(countSql, ...params),
    ]);

    const totalItems = Number(countRows[0]?.count || 0);

    const companies: Company[] = rows.map((row) => this.mapCompanyRow(row, mode));

    const response: CompaniesListResponse = {
      companies,
      pagination: {
        currentPage,
        totalPages: Math.ceil(totalItems / itemsPerPage) || 1,
        totalItems,
        itemsPerPage,
      },
    };

    if (includeStats !== 'false' && mode !== 'simple') {
      const companyIds = companies.map((c) => c.id).filter(Boolean);
      const aggregatedStats = await this.computeAggregatedStats(
        companyIds,
        whereClause,
        params,
      );
      response.aggregatedStats = aggregatedStats;

      if (companyIds.length > 0) {
        const stats = await this.computePerCompanyStats(companyIds);
        for (const company of companies) {
          const s = stats.get(company.id);
          company.total_deals = s?.deal_count ?? 0;
          company.total_projects = s?.project_count ?? 0;
          company.total_tasks = s?.task_count ?? 0;
          company.total_revenue =
            (s?.invoice_value ?? 0) + (s?.deal_value ?? 0) + (s?.project_value ?? 0);
        }
      }
    }

    return response;
  }

  private mapCompanyRow(row: Record<string, unknown>, mode?: string): Company {
    const company: Company = {
      id: Number(row.id),
      name: String(row.name),
      contact_person: row.contact_person as string | null,
      domain: row.domain as string | null,
      industry: row.industry as string | null,
      company_size: row.company_size as string | null,
      annual_revenue: row.annual_revenue as number | string | null,
      phone: row.phone as string | null,
      email: row.email as string | null,
      address_line1: row.address_line1 as string | null,
      address_line2: row.address_line2 as string | null,
      city: row.city as string | null,
      state: row.state as string | null,
      postal_code: row.postal_code as string | null,
      country: row.country as string | null,
      description: row.description as string | null,
      logo_url: row.logo_url as string | null,
      linkedin_url: row.linkedin_url as string | null,
      twitter_url: row.twitter_url as string | null,
      facebook_url: row.facebook_url as string | null,
      owner_id: row.owner_id != null ? Number(row.owner_id) : null,
      parent_company_id:
        row.parent_company_id != null ? Number(row.parent_company_id) : null,
      agent_id: row.agent_id != null ? Number(row.agent_id) : null,
      lifecycle_stage: row.lifecycle_stage as string,
      lead_source: row.lead_source as string | null,
      last_activity_at: row.last_activity_at as string | null,
      total_revenue: toNum(row.total_revenue),
      total_deals: Number(row.total_deals ?? 0),
      custom_fields: row.custom_fields as Record<string, unknown> | null,
      tags: Array.isArray(row.tags) ? row.tags : [],
      is_active: row.is_active as boolean,
      is_demo: row.is_demo as boolean,
      created_at: row.created_at as string | Date,
      updated_at: row.updated_at as string | Date,
      deleted_at: row.deleted_at as string | Date | null,
    };

    if (row.owner_first_name || row.owner_last_name) {
      company.owner = {
        id: Number(row.owner_id),
        first_name:
          typeof row.owner_first_name === 'string' ? row.owner_first_name : '',
        last_name:
          typeof row.owner_last_name === 'string' ? row.owner_last_name : '',
      };
    }

    if (row.contact_id) {
      const contact = {
        id: Number(row.contact_id),
        name:
          typeof row.contact_name === 'string' ? row.contact_name : '',
        email:
          typeof row.contact_email === 'string' ? row.contact_email : '',
        phone: row.contact_phone as string | null,
      };
      company.primary_contact = contact;
      company.effective_email = company.email || contact.email || null;
      company.effective_phone = company.phone || contact.phone || null;
    } else {
      company.effective_email = company.email || null;
      company.effective_phone = company.phone || null;
    }

    if (mode === 'simple') {
      return {
        id: company.id,
        name: company.name,
        total_deals: 0,
        total_projects: 0,
        total_tasks: 0,
        total_revenue: 0,
      };
    }

    return company;
  }

  private async computePerCompanyStats(
    companyIds: number[],
  ): Promise<Map<number, any>> {
    const safeIds = companyIds.filter((id) => Number.isFinite(id));
    if (safeIds.length === 0) return new Map();

    const idsParam = safeIds.join(',');

    const invoiceStats = await this.prisma.$queryRawUnsafe<
      Array<{ company_id: number; value: unknown }>
    >(
      `
      SELECT company_id, SUM(total_amount) AS value
      FROM invoices
      WHERE company_id IN (${idsParam})
        AND deleted_at IS NULL
        AND status NOT IN ('void', 'cancelled', 'canceled')
        AND (document_type = 'invoice' OR document_type IS NULL)
      GROUP BY company_id
      `,
    );

    const dealStats = await this.prisma.$queryRawUnsafe<
      Array<{ company_id: number; value: unknown }>
    >(
      `
      SELECT d.company_id, SUM(d.value) AS value
      FROM deals d
      WHERE d.company_id IN (${idsParam})
        AND d.deleted_at IS NULL
        AND d.status IN ('open', 'won')
        AND NOT EXISTS (
          SELECT 1 FROM invoices i
          WHERE i.deal_id = d.id AND i.company_id = d.company_id
            AND i.deleted_at IS NULL
            AND i.status NOT IN ('void', 'cancelled', 'canceled')
        )
      GROUP BY d.company_id
      `,
    );

    const projectStats = await this.prisma.$queryRawUnsafe<
      Array<{ company_id: number; value: unknown }>
    >(
      `
      SELECT p.company_id, SUM(
        COALESCE(p.budget, p.actual_hours * p.hourly_rate, p.estimated_hours * p.hourly_rate, 0)
      ) AS value
      FROM crm_projects p
      WHERE p.company_id IN (${idsParam})
        AND p.deleted_at IS NULL
        AND p.status != 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM invoices i
          WHERE i.crm_project_id = p.id AND i.company_id = p.company_id
            AND i.deleted_at IS NULL
            AND i.status NOT IN ('void', 'cancelled', 'canceled')
        )
      GROUP BY p.company_id
      `,
    );

    const dealCount = await this.prisma.$queryRawUnsafe<
      Array<{ company_id: number; count: number }>
    >(
      `
      SELECT company_id, COUNT(id) AS count
      FROM deals
      WHERE company_id IN (${idsParam})
        AND status IN ('open', 'won')
      GROUP BY company_id
      `,
    );

    const projectCount = await this.prisma.$queryRawUnsafe<
      Array<{ company_id: number; count: number }>
    >(
      `
      SELECT company_id, COUNT(id) AS count
      FROM crm_projects
      WHERE company_id IN (${idsParam})
      GROUP BY company_id
      `,
    );

    const taskCount = await this.prisma.$queryRawUnsafe<
      Array<{ company_id: number; count: number }>
    >(
      `
      SELECT p.company_id, COUNT(t.id) AS count
      FROM project_tasks t
      INNER JOIN crm_projects p ON p.id = t.crm_project_id
      WHERE p.company_id IN (${idsParam})
        AND p.deleted_at IS NULL
        AND t.deleted_at IS NULL
      GROUP BY p.company_id
      `,
    );

    const toMap = (arr: Array<{ company_id: number; value: unknown }>) => {
      const map = new Map<number, number>();
      for (const row of arr) {
        map.set(Number(row.company_id), toNum(row.value));
      }
      return map;
    };

    const countMap = (
      arr: Array<{ company_id: number; count: unknown }>,
    ) => {
      const map = new Map<number, number>();
      for (const row of arr) {
        map.set(Number(row.company_id), Number(row.count || 0));
      }
      return map;
    };

    const iLookup = toMap(invoiceStats);
    const dLookup = toMap(dealStats);
    const pLookup = toMap(projectStats);
    const dCountLookup = countMap(dealCount);
    const pCountLookup = countMap(projectCount);
    const tCountLookup = countMap(taskCount);

    const result = new Map<number, any>();
    for (const id of safeIds) {
      result.set(id, {
        invoice_value: iLookup.get(id) || 0,
        deal_value: dLookup.get(id) || 0,
        project_value: pLookup.get(id) || 0,
        deal_count: dCountLookup.get(id) || 0,
        project_count: pCountLookup.get(id) || 0,
        task_count: tCountLookup.get(id) || 0,
      });
    }
    return result;
  }

  private async computeAggregatedStats(
    pageCompanyIds: number[],
    whereClause: string,
    params: (string | number)[],
  ): Promise<AggregatedStats> {
    // Fetch all matching company IDs (not just current page) for value aggregation.
    const allIdsSql = `
      SELECT c.id
      FROM companies c
      WHERE ${whereClause}
    `;
    const allIdRows = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
      allIdsSql,
      ...params,
    );
    const allIds = allIdRows.map((r) => Number(r.id));

    let totalValue = 0;
    if (allIds.length > 0) {
      const idsParam = allIds.join(',');
      const valueRow = await this.prisma.$queryRawUnsafe<
        Array<{ total_value: unknown }>
      >(
        `
        SELECT
          COALESCE((
            SELECT SUM(i.total_amount)
            FROM invoices i
            WHERE i.company_id IN (${idsParam})
              AND i.deleted_at IS NULL
              AND i.status NOT IN ('void', 'cancelled', 'canceled')
              AND (i.document_type = 'invoice' OR i.document_type IS NULL)
          ), 0) +
          COALESCE((
            SELECT SUM(d.value)
            FROM deals d
            WHERE d.company_id IN (${idsParam})
              AND d.deleted_at IS NULL
              AND d.status IN ('open', 'won')
              AND NOT EXISTS (
                SELECT 1 FROM invoices i
                WHERE i.deal_id = d.id AND i.company_id = d.company_id
                  AND i.deleted_at IS NULL
                  AND i.status NOT IN ('void', 'cancelled', 'canceled')
              )
          ), 0) +
          COALESCE((
            SELECT SUM(
              COALESCE(p.budget, p.actual_hours * p.hourly_rate, p.estimated_hours * p.hourly_rate, 0)
            )
            FROM crm_projects p
            WHERE p.company_id IN (${idsParam})
              AND p.deleted_at IS NULL
              AND p.status != 'cancelled'
              AND NOT EXISTS (
                SELECT 1 FROM invoices i
                WHERE i.crm_project_id = p.id AND i.company_id = p.company_id
                  AND i.deleted_at IS NULL
                  AND i.status NOT IN ('void', 'cancelled', 'canceled')
              )
          ), 0) AS total_value
        `,
      );
      totalValue = toNum(valueRow[0]?.total_value || 0);
    }

    const totalDealsSql = `
      SELECT COUNT(d.id)::int AS count
      FROM deals d
      JOIN companies c ON c.id = d.company_id
      WHERE d.status IN ('open', 'won')
        AND d.deleted_at IS NULL
        AND ${whereClause.replace(/c\./g, 'c.')}
    `;
    const totalDealsRows = await this.prisma.$queryRawUnsafe<
      Array<{ count: number }>
    >(totalDealsSql, ...params);
    const totalDeals = Number(totalDealsRows[0]?.count || 0);

    const customerCountSql = `
      SELECT COUNT(c.id)::int AS count
      FROM companies c
      WHERE ${whereClause}
        AND c.lifecycle_stage IN ('customer', 'evangelist')
    `;
    const customerCountRows = await this.prisma.$queryRawUnsafe<
      Array<{ count: number }>
    >(customerCountSql, ...params);
    const customerCount = Number(customerCountRows[0]?.count || 0);

    return {
      totalValue,
      totalDeals,
      customerCount,
    };
  }

  // Single company

  async findOne(id: number): Promise<Company & Record<string, unknown>> {
    const company = (await this.prisma.companies.findUnique({
      where: { id },
    })) as unknown as Record<string, unknown>;
    if (!company) throw new NotFoundException('Company not found');

    const ownerId = company.owner_id as number | null;
    const owner = ownerId
      ? await this.prisma.profiles.findUnique({
          where: { id: ownerId },
          select: { id: true, first_name: true, last_name: true, email: true },
        })
      : null;

    const primaryContactRow = await this.prisma.$queryRawUnsafe<
      Array<{
        contact_id: number;
        contact_name: string;
        contact_email: string;
        contact_phone: string | null;
      }>
    >(
      `
      SELECT c.id AS contact_id, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
      FROM crm_contact_companies ccc
      JOIN contacts c ON c.id = ccc.contact_id
      WHERE ccc.company_id = $1 AND ccc.is_primary = true
      ORDER BY ccc.created_at DESC
      LIMIT 1
      `,
      id,
    );

    const primaryContact = primaryContactRow[0]
      ? {
          id: Number(primaryContactRow[0].contact_id),
          name: primaryContactRow[0].contact_name,
          email: primaryContactRow[0].contact_email,
          phone: primaryContactRow[0].contact_phone,
        }
      : null;

    const [dealCount, projectCount, ticketCount] = await Promise.all([
      this.prisma.deals.count({
        where: { company_id: id, status: { in: ['open', 'won'] } },
      }),
      this.prisma.crm_projects.count({
        where: { company_id: id, deleted_at: null },
      }),
      this.prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `
        SELECT COUNT(*)::int AS count
        FROM tickets t
        INNER JOIN crm_projects p ON p.id = t.crm_project_id
        WHERE p.company_id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL
        `,
        id,
      ),
    ]);

    return {
      ...company,
      owner,
      primary_contact: primaryContact,
      effective_email: company.email || primaryContact?.email || null,
      effective_phone: company.phone || primaryContact?.phone || null,
      total_deals: dealCount,
      total_projects: projectCount,
      total_tickets: Number(ticketCount[0]?.count ?? 0),
    } as Company & Record<string, unknown>;
  }

  async create(userId: number, dto: CreateCompanyDto) {
    const data: Prisma.companiesUncheckedCreateInput = {
      name: dto.name,
      contact_person: dto.contact_person,
      email: dto.email,
      domain: dto.domain,
      industry: dto.industry,
      company_size: mapCompanySize(dto.company_size),
      phone: dto.phone,
      address_line1: dto.address_line1,
      address_line2: dto.address_line2,
      city: dto.city,
      state: dto.state,
      postal_code: dto.postal_code,
      country: dto.country,
      description: dto.description,
      logo_url: dto.logo_url,
      linkedin_url: dto.linkedin_url,
      twitter_url: dto.twitter_url,
      facebook_url: dto.facebook_url,
      lifecycle_stage: dto.lifecycle_stage as enum_crm_companies_lifecycle_stage,
      lead_source: dto.lead_source,
      owner_id: dto.owner_id || userId,
      custom_fields: asJsonInput(dto.custom_fields),
      tags: asJsonInput(dto.tags),
      is_active: dto.is_active ?? true,
    };

    const company = await this.prisma.companies.create({ data });

    // Auto-link matching users and contacts
    await this.autoLinkUsersAndContacts(company.id, dto.name, dto.domain);

    return this.findOne(company.id);
  }

  private async autoLinkUsersAndContacts(
    companyId: number,
    name?: string,
    domain?: string,
  ) {
    if (!name && !domain) return;

    const users = await this.prisma.profiles.findMany({
      where: {
        role: 'customer',
        OR: [
          ...(name ? [{ company: name }] : []),
          ...(domain ? [{ email: { contains: `@${domain}` } }] : []),
        ],
      },
    });

    for (const user of users) {
      if (!user.company_id) {
        await this.prisma.profiles.update({
          where: { id: user.id },
          data: { company_id: companyId },
        });
      }
      const contact = user.email
        ? await this.prisma.contacts.findFirst({ where: { email: user.email } })
        : null;
      if (contact) {
        const existing = await this.prisma.crm_contact_companies.findFirst({
          where: { contact_id: contact.id, company_id: companyId },
        });
        if (!existing) {
          await this.prisma.crm_contact_companies.create({
            data: {
              contact_id: contact.id,
              company_id: companyId,
              is_primary: true,
              job_title: user.job_title || null,
            },
          });
        }
      }
    }

    const contacts = await this.prisma.contacts.findMany({
      where: {
        OR: [
          ...(name ? [{ company: name }] : []),
          ...(domain ? [{ email: { contains: `@${domain}` } }] : []),
        ],
      },
    });

    for (const contact of contacts) {
      const existing = await this.prisma.crm_contact_companies.findFirst({
        where: { contact_id: contact.id, company_id: companyId },
      });
      if (!existing) {
        await this.prisma.crm_contact_companies.create({
          data: {
            contact_id: contact.id,
            company_id: companyId,
            is_primary: false,
            job_title: contact.job_title || null,
          },
        });
      }
      if (contact.user_id) {
        const linkedUser = await this.prisma.profiles.findUnique({
          where: { id: contact.user_id },
        });
        if (linkedUser && !linkedUser.company_id) {
          await this.prisma.profiles.update({
            where: { id: linkedUser.id },
            data: { company_id: companyId },
          });
        }
      }
    }
  }

  async update(id: number, dto: UpdateCompanyDto) {
    const existing = await this.prisma.companies.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Company not found');

    const data: Prisma.companiesUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.contact_person !== undefined) data.contact_person = dto.contact_person;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.domain !== undefined) data.domain = dto.domain;
    if (dto.industry !== undefined) data.industry = dto.industry;
    if (dto.company_size !== undefined)
      data.company_size = mapCompanySize(dto.company_size);
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address_line1 !== undefined) data.address_line1 = dto.address_line1;
    if (dto.address_line2 !== undefined) data.address_line2 = dto.address_line2;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.postal_code !== undefined) data.postal_code = dto.postal_code;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.logo_url !== undefined) data.logo_url = dto.logo_url;
    if (dto.linkedin_url !== undefined) data.linkedin_url = dto.linkedin_url;
    if (dto.twitter_url !== undefined) data.twitter_url = dto.twitter_url;
    if (dto.facebook_url !== undefined) data.facebook_url = dto.facebook_url;
    if (dto.lifecycle_stage !== undefined)
      data.lifecycle_stage = dto.lifecycle_stage as enum_crm_companies_lifecycle_stage;
    if (dto.lead_source !== undefined) data.lead_source = dto.lead_source;
    if (dto.owner_id !== undefined) data.owner_id = dto.owner_id;
    if (dto.custom_fields !== undefined) data.custom_fields = asJsonInput(dto.custom_fields);
    if (dto.tags !== undefined) data.tags = asJsonInput(dto.tags);
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    await this.prisma.companies.update({ where: { id }, data });
    return this.findOne(id);
  }

  async delete(id: number) {
    const existing = await this.prisma.companies.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Company not found');

    await this.prisma.companies.update({
      where: { id },
      data: { is_active: false, deleted_at: new Date() },
    });
    return { message: 'Company deleted successfully' };
  }

  // Users

  async findUsers(id: number) {
    await this.ensureCompanyExists(id);
    const users = await this.prisma.profiles.findMany({
      where: { company_id: id },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        job_title: true,
        avatar: true,
        last_login: true,
        created_at: true,
      },
    });
    return { users };
  }

  // Invoices

  async findInvoices(id: number, status?: string, type?: string, page = 1, limit = 20) {
    await this.ensureCompanyExists(id);
    const where: Prisma.invoicesWhereInput = { company_id: id };
    if (status && status !== 'all') where.status = status;
    if (type && type !== 'all') where.document_type = type as Prisma.invoicesWhereInput['document_type'];

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

  // Payments

  async findPayments(id: number, status?: string, page = 1, limit = 20) {
    await this.ensureCompanyExists(id);
    const invoices = await this.prisma.invoices.findMany({
      where: { company_id: id },
      select: { id: true },
    });
    const invoiceIds = invoices.map((i) => i.id);

    if (invoiceIds.length === 0) {
      return buildLegacyList('payments', [], 0, page, limit);
    }

    const where: Prisma.paymentsWhereInput = {
      invoice_id: { in: invoiceIds },
    };
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

  // Value breakdown

  async getValueBreakdown(id: number) {
    await this.ensureCompanyExists(id);
    const company = await this.prisma.companies.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    const invoices = await this.prisma.$queryRawUnsafe<
      Array<{
        id: number;
        package_code: string;
        client_name: string;
        total_amount: unknown;
        status: string;
        currency: string;
        issue_date: Date;
      }>
    >(
      `
      SELECT id, package_code, client_name, total_amount, status, currency, issue_date
      FROM invoices
      WHERE company_id = $1
        AND deleted_at IS NULL
        AND status NOT IN ('void', 'cancelled', 'canceled')
        AND (document_type = 'invoice' OR document_type IS NULL)
      ORDER BY issue_date DESC
      `,
      id,
    );

    const deals = await this.prisma.$queryRawUnsafe<
      Array<{
        id: number;
        deal_number: string;
        title: string;
        value: unknown;
        currency: string;
        status: string;
        actual_close_date: Date;
      }>
    >(
      `
      SELECT id, deal_number, title, value, currency, status, actual_close_date
      FROM deals
      WHERE company_id = $1
        AND deleted_at IS NULL
        AND status IN ('open', 'won')
        AND NOT EXISTS (
          SELECT 1 FROM invoices i
          WHERE i.deal_id = deals.id AND i.company_id = $1
            AND i.deleted_at IS NULL
            AND i.status NOT IN ('void', 'cancelled', 'canceled')
        )
      ORDER BY actual_close_date DESC
      `,
      id,
    );

    const projects = await this.prisma.$queryRawUnsafe<
      Array<{
        id: number;
        project_number: string;
        name: string;
        computed_value: unknown;
        budget: unknown;
        actual_hours: unknown;
        hourly_rate: unknown;
        currency: string;
        status: string;
      }>
    >(
      `
      SELECT id, project_number, name,
        COALESCE(budget, actual_hours * hourly_rate, estimated_hours * hourly_rate, 0) AS computed_value,
        budget, actual_hours, hourly_rate, currency, status
      FROM crm_projects
      WHERE company_id = $1
        AND deleted_at IS NULL
        AND status != 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM invoices i
          WHERE i.crm_project_id = crm_projects.id AND i.company_id = $1
            AND i.deleted_at IS NULL
            AND i.status NOT IN ('void', 'cancelled', 'canceled')
        )
      ORDER BY created_at DESC
      `,
      id,
    );

    const breakdown: Array<{
      type: string;
      id: number;
      reference: string;
      description: string;
      amount: number;
      currency: string;
      status: string;
      date: Date | null;
    }> = [];

    for (const inv of invoices) {
      const amount = toNumber(inv.total_amount);
      if (amount > 0) {
        breakdown.push({
          type: 'invoice',
          id: inv.id,
          reference: inv.package_code,
          description: `Invoice ${inv.package_code}${inv.client_name ? ` - ${inv.client_name}` : ''}`,
          amount,
          currency: inv.currency || 'AUD',
          status: inv.status,
          date: inv.issue_date,
        });
      }
    }

    for (const deal of deals) {
      const amount = toNumber(deal.value);
      if (amount > 0) {
        breakdown.push({
          type: 'deal',
          id: deal.id,
          reference: deal.deal_number,
          description: `Deal: ${deal.title}`,
          amount,
          currency: deal.currency || 'AUD',
          status: deal.status,
          date: deal.actual_close_date,
        });
      }
    }

    for (const project of projects) {
      const amount = toNumber(project.computed_value);
      if (amount > 0) {
        breakdown.push({
          type: 'project',
          id: project.id,
          reference: project.project_number,
          description: `Project: ${project.name}`,
          amount,
          currency: project.currency || 'AUD',
          status: project.status,
          date: null,
        });
      }
    }

    breakdown.sort((a, b) => b.amount - a.amount);

    return {
      company_id: company?.id,
      company_name: company?.name,
      total: breakdown.reduce((sum, item) => sum + item.amount, 0),
      currency: 'AUD',
      breakdown,
      counts: {
        invoices: invoices.length,
        deals: deals.length,
        projects: projects.length,
      },
    };
  }

  async findContacts(id: number) {
    await this.ensureCompanyExists(id);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        contact_id: number;
        name: string;
        email: string;
        phone: string | null;
        is_primary: boolean;
        lifecycle_stage: string | null;
        lead_score: number | null;
      }>
    >(
      `
      SELECT c.id AS contact_id, c.name, c.email, c.phone, ccc.is_primary, c.lifecycle_stage, c.lead_score
      FROM crm_contact_companies ccc
      JOIN contacts c ON c.id = ccc.contact_id
      WHERE ccc.company_id = $1
      ORDER BY ccc.is_primary DESC, c.name ASC
      `,
      id,
    );
    return {
      contacts: rows.map((r) => ({
        id: Number(r.contact_id),
        name: r.name,
        email: r.email,
        phone: r.phone,
        is_primary: r.is_primary,
        lifecycle_stage: r.lifecycle_stage,
        lead_score: r.lead_score,
      })),
    };
  }

  async findDeals(id: number) {
    await this.ensureCompanyExists(id);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: number;
        deal_number: string;
        title: string;
        value: unknown;
        currency: string;
        status: string;
        stage: string | null;
        actual_close_date: Date | null;
        expected_close_date: Date | null;
      }>
    >(
      `
      SELECT id, deal_number, title, value, currency, status, stage, actual_close_date, expected_close_date
      FROM deals
      WHERE company_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      `,
      id,
    );
    return {
      deals: rows.map((r) => ({
        ...r,
        id: Number(r.id),
        value: toNumber(r.value),
      })),
    };
  }

  async findProjects(id: number) {
    await this.ensureCompanyExists(id);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: number;
        project_number: string;
        name: string;
        budget: unknown;
        currency: string;
        status: string;
        progress_percentage: number | null;
        due_date: Date | null;
      }>
    >(
      `
      SELECT id, project_number, name, budget, currency, status, progress_percentage, due_date
      FROM crm_projects
      WHERE company_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      `,
      id,
    );
    return {
      projects: rows.map((r) => ({
        ...r,
        id: Number(r.id),
        budget: toNumber(r.budget),
      })),
    };
  }

  async findTickets(id: number) {
    await this.ensureCompanyExists(id);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: number;
        ticket_number: string;
        subject: string;
        status: string;
        priority: string;
        category: string | null;
        created_at: Date | null;
      }>
    >(
      `
      SELECT t.id, t.ticket_number, t.subject, t.status, t.priority, t.category, t.created_at
      FROM tickets t
      INNER JOIN crm_projects p ON p.id = t.crm_project_id
      WHERE p.company_id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL
      ORDER BY t.created_at DESC
      `,
      id,
    );
    return {
      tickets: rows.map((r) => ({ ...r, id: Number(r.id) })),
    };
  }

  // Documents

  async getDocuments(id: number, category?: string, status?: string, page = 1, limit = 50) {
    await this.ensureCompanyExists(id);
    const where: Prisma.company_documentsWhereInput = { company_id: id };
    if (category && category !== 'all') where.category = category;
    if (status && status !== 'all') where.status = status;

    const [documents, total] = await Promise.all([
      this.prisma.company_documents.findMany({
        where,
        include: { profiles: { select: { id: true, first_name: true, last_name: true } } },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.company_documents.count({ where }),
    ]);

    const companyDocs = documents.map((d) => ({ ...d, source: 'company' }));

    // Subproject documents (best-effort, metadata only)
    const subprojectDocs: unknown[] = [];

    return {
      documents: companyDocs,
      subprojectDocuments: subprojectDocs,
      company: { id, name: (await this.findOne(id)).name },
      pagination: buildPagination(total, page, limit),
    };
  }

  async uploadDocument(
    userId: number,
    companyId: number,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    dto: CompanyDocumentUploadDto,
  ) {
    await this.ensureCompanyExists(companyId);

    const fileName = file.originalname;
    const fileUrl = `/uploads/documents/company-${companyId}/${Date.now()}-${fileName}`;

    const tags = dto.tags ? this.parseTags(dto.tags) : [];

    const document = await this.prisma.company_documents.create({
      data: {
        company_id: companyId,
        name: dto.name || fileName,
        description: dto.description,
        file_url: fileUrl,
        file_name: fileName,
        file_size: file.size,
        file_type: file.mimetype,
        category: dto.category || 'other',
        tags: asJsonInput(tags),
        is_client_visible: dto.is_client_visible !== 'false',
        version: dto.version || '1.0',
        expires_at: safeDate(dto.expires_at),
        internal_notes: dto.internal_notes,
        uploaded_by: userId,
        status: 'active',
      },
      include: { profiles: { select: { id: true, first_name: true, last_name: true } } },
    });

    return { message: 'Document uploaded successfully', document };
  }

  async getDocument(companyId: number, docId: number) {
    const document = await this.prisma.company_documents.findFirst({
      where: { id: docId, company_id: companyId },
      include: {
        profiles: { select: { id: true, first_name: true, last_name: true } },
        companies: { select: { id: true, name: true } },
      },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  async updateDocument(
    companyId: number,
    docId: number,
    dto: CompanyDocumentUploadDto,
  ) {
    const document = await this.prisma.company_documents.findFirst({
      where: { id: docId, company_id: companyId },
    });
    if (!document) throw new NotFoundException('Document not found');

    const data: Prisma.company_documentsUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.is_client_visible !== undefined)
      data.is_client_visible = dto.is_client_visible === 'true';
    if (dto.tags !== undefined) data.tags = asJsonInput(this.parseTags(dto.tags));
    if (dto.internal_notes !== undefined) data.internal_notes = dto.internal_notes;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.expires_at !== undefined) data.expires_at = safeDate(dto.expires_at);

    const updated = await this.prisma.company_documents.update({
      where: { id: docId },
      data,
      include: { profiles: { select: { id: true, first_name: true, last_name: true } } },
    });

    return { message: 'Document updated successfully', document: updated };
  }

  async deleteDocument(companyId: number, docId: number) {
    const document = await this.prisma.company_documents.findFirst({
      where: { id: docId, company_id: companyId },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.prisma.company_documents.delete({ where: { id: docId } });
    return { message: 'Document deleted successfully' };
  }

  private parseTags(value?: string): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : value.split(',').map((t) => t.trim()).filter(Boolean);
    } catch {
      return value.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  private async ensureCompanyExists(id: number) {
    const company = await this.prisma.companies.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Company not found');
  }
}
