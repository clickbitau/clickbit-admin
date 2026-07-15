import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AggregatedStats,
  CompaniesListResponse,
  Company,
  GetCompaniesQueryDto,
  ALLOWED_COMPANY_SORT,
} from '@clickbit/shared';

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
}
