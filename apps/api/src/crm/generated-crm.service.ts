import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SOFT_DELETE_MODELS = new Set([
  'companies',
  'contacts',
  'deals',
  'crm_projects',
  'crm_subprojects',
  'project_tasks',
]);

function buildSearch(search: string | undefined, fields: string[]) {
  if (!search || !fields.length) return undefined;
  return {
    OR: fields.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' as const },
    })),
  };
}

@Injectable()
export class GeneratedCrmService {
  constructor(private readonly prisma: PrismaService) {}

  private getDelegate(model: string) {
    const delegate = (this.prisma as any)[model];
    if (!delegate) {
      throw new Error(`Unknown Prisma model: ${model}`);
    }
    return delegate;
  }

  async findAll(
    model: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      searchFields?: string[];
      additionalWhere?: Record<string, unknown>;
      orderBy?: Record<string, string>;
      include?: Record<string, unknown>;
    },
  ) {
    const page = Math.max(1, Number(options.page ?? 1));
    const itemsPerPage = Math.min(100, Math.max(1, Number(options.limit ?? 20)));
    const searchWhere = buildSearch(options.search, options.searchFields ?? []);
    const where: any = { ...options.additionalWhere };
    if (SOFT_DELETE_MODELS.has(model)) {
      where.deleted_at = null;
    }
    if (searchWhere) {
      where.AND = [where, searchWhere];
    }
    const delegate = this.getDelegate(model);
    const [totalItems, rows] = await Promise.all([
      delegate.count({ where }),
      delegate.findMany({
        where,
        skip: (page - 1) * itemsPerPage,
        take: itemsPerPage,
        orderBy: options.orderBy ?? { created_at: 'desc' },
        include: options.include,
      }),
    ]);
    const keyMap: Record<string, string> = {
      contacts: 'contacts',
      deals: 'deals',
      crm_pipelines: 'pipelines',
      crm_leads: 'leads',
      crm_projects: 'projects',
      crm_activities: 'activities',
      crm_notes: 'notes',
      crm_automations: 'automations',
    };
    return {
      [keyMap[model] ?? model]: rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / itemsPerPage) || 1,
        totalItems,
        itemsPerPage,
      },
    };
  }

  async findOne(model: string, id: string | number, include?: Record<string, unknown>) {
    const delegate = this.getDelegate(model);
    const where: any = { id: Number(id) };
    if (SOFT_DELETE_MODELS.has(model)) {
      where.deleted_at = null;
    }
    const record = await delegate.findUnique({ where, include });
    if (!record) throw new NotFoundException(`${model} not found`);
    return record;
  }

  create(model: string, data: Record<string, unknown>) {
    const delegate = this.getDelegate(model);
    return delegate.create({ data });
  }

  update(model: string, id: string | number, data: Record<string, unknown>) {
    const delegate = this.getDelegate(model);
    return delegate.update({ where: { id: Number(id) }, data });
  }

  remove(model: string, id: string | number) {
    const delegate = this.getDelegate(model);
    if (SOFT_DELETE_MODELS.has(model)) {
      return delegate.update({ where: { id: Number(id) }, data: { deleted_at: new Date() } });
    }
    return delegate.delete({ where: { id: Number(id) } });
  }
}
