import { CompaniesController } from '../src/crm/companies.controller';
import { CompaniesService } from '../src/crm/companies.service';

describe('CRM legacy contract tests', () => {
  describe('GET /api/crm/companies', () => {
    const resMock = { set: jest.fn().mockReturnThis() } as unknown as any;

    const companyRow = {
      id: 1,
      name: 'Acme Corp',
      contact_person: null,
      domain: 'acme.test',
      industry: 'Technology',
      company_size: null,
      annual_revenue: null,
      phone: null,
      email: 'hello@acme.test',
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      description: null,
      logo_url: null,
      linkedin_url: null,
      twitter_url: null,
      facebook_url: null,
      owner_id: 42,
      owner_first_name: 'Alice',
      owner_last_name: 'Admin',
      parent_company_id: null,
      agent_id: null,
      lifecycle_stage: 'lead',
      lead_source: null,
      last_activity_at: null,
      total_revenue: 0,
      total_deals: 0,
      custom_fields: {},
      tags: [],
      is_active: true,
      is_demo: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      contact_id: null,
      contact_name: null,
      contact_email: null,
      contact_phone: null,
    };

    const buildPrismaMock = (
      row: Record<string, unknown>,
      total: number,
    ): { $queryRawUnsafe: jest.Mock } => {
      return {
        $queryRawUnsafe: jest.fn((query: string) => {
          if (query.includes('COUNT(DISTINCT c.id)')) {
            return Promise.resolve([{ count: total }]);
          }
          if (query.includes('LIMIT')) {
            return Promise.resolve([row]);
          }
          if (query.includes('SELECT c.id')) {
            return Promise.resolve([{ id: row.id }]);
          }
          if (query.includes('total_value')) {
            return Promise.resolve([{ total_value: 0 }]);
          }
          if (query.includes('SUM(i.total_amount)')) {
            return Promise.resolve([{ company_id: row.id, value: 0 }]);
          }
          if (query.includes('FROM deals d')) {
            return Promise.resolve([{ company_id: row.id, value: 0 }]);
          }
          if (query.includes('FROM crm_projects p')) {
            return Promise.resolve([{ company_id: row.id, value: 0 }]);
          }
          if (query.includes('COUNT(id) AS count')) {
            return Promise.resolve([{ company_id: row.id, count: 0 }]);
          }
          if (query.includes('project_tasks')) {
            return Promise.resolve([{ company_id: row.id, count: 0 }]);
          }
          return Promise.resolve([]);
        }),
      };
    };

    let controller: CompaniesController;

    beforeEach(() => {
      const prismaMock = buildPrismaMock(companyRow, 1);
      const service = new CompaniesService(prismaMock as any);
      controller = new CompaniesController(service);
    });

    it('returns the legacy list envelope { companies, pagination }', async () => {
      const result = await controller.findAll(
        {
          page: 1,
          limit: 50,
          sortBy: 'updated_at',
          sortOrder: 'DESC',
          includeStats: 'false',
        },
        resMock,
      );

      expect(result).toHaveProperty('companies');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.companies)).toBe(true);
      expect(result.pagination).toMatchObject({
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 50,
      });
      expect(result.companies[0]).toMatchObject({
        id: companyRow.id,
        name: companyRow.name,
      });
    });

    it('adds aggregatedStats when includeStats is truthy and mode is not simple', async () => {
      const result = await controller.findAll(
        {
          page: 1,
          limit: 50,
          sortBy: 'updated_at',
          sortOrder: 'DESC',
          includeStats: 'true',
        },
        resMock,
      );

      expect(result).toHaveProperty('companies');
      expect(result).toHaveProperty('pagination');
      expect(result).toHaveProperty('aggregatedStats');
      expect(result.aggregatedStats).toMatchObject({
        totalValue: expect.any(Number),
        totalDeals: expect.any(Number),
        customerCount: expect.any(Number),
      });
    });

    it('returns simplified company objects when mode=simple', async () => {
      const result = await controller.findAll(
        {
          page: 1,
          limit: 50,
          mode: 'simple',
        },
        resMock,
      );

      expect(result.companies[0]).toEqual({
        id: companyRow.id,
        name: companyRow.name,
        total_deals: 0,
        total_projects: 0,
        total_tasks: 0,
        total_revenue: 0,
      });
    });

    it('sets anti-caching headers', async () => {
      await controller.findAll(
        {
          page: 1,
          limit: 50,
          includeStats: 'false',
        },
        resMock,
      );

      expect(resMock.set).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      expect(resMock.set).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(resMock.set).toHaveBeenCalledWith('Expires', '0');
      expect(resMock.set).toHaveBeenCalledWith('Surrogate-Control', 'no-store');
    });
  });

  describe('GET /api/crm/deals (legacy envelope contract)', () => {
    const sampleDeal = {
      id: 10,
      deal_number: 'DEAL-000010',
      title: 'Big Sale',
      description: null,
      value: 5000,
      currency: 'AUD',
      pipeline_id: 1,
      stage_id: 2,
      owner_id: 5,
      status: 'open',
      priority: 'high',
      probability: 50,
      expected_close_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('list response uses { deals, pagination } envelope', () => {
      const legacy = {
        deals: [sampleDeal],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 50,
        },
      };

      expect(legacy).toHaveProperty('deals');
      expect(legacy).toHaveProperty('pagination');
      expect(Array.isArray(legacy.deals)).toBe(true);
      expect(legacy.pagination).toMatchObject({
        currentPage: expect.any(Number),
        totalPages: expect.any(Number),
        totalItems: expect.any(Number),
        itemsPerPage: expect.any(Number),
      });
    });

    it('single-deal response is wrapped as { deal: object }', () => {
      const legacy = { deal: sampleDeal };
      expect(legacy).toHaveProperty('deal');
      expect(legacy.deal).toMatchObject({
        id: expect.any(Number),
        title: expect.any(String),
        value: expect.any(Number),
        status: expect.any(String),
      });
    });
  });
});
