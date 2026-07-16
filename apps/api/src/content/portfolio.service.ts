import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { asJson, buildMessageEnvelope, numberValue, parseJson, slugify, stringValue } from './content-utils';

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: Record<string, unknown>) {
    const where: any = { status: 'published', deleted_at: null };
    if (query.category) where.category = stringValue(query.category);
    if (query.featured === 'true') where.featured = true;
    if (query.technology) where.technologies = { contains: stringValue(query.technology), mode: 'insensitive' };
    if (query.service) where.services_provided = { contains: stringValue(query.service), mode: 'insensitive' };

    const limit = numberValue(query.limit, 0);
    const offset = numberValue(query.offset, 0);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.portfolio_items.count({ where }),
      this.prisma.portfolio_items.findMany({ where, orderBy: [{ sort_order: 'asc' }, { project_date: 'desc' }], ...(limit ? { skip: offset, take: limit } : {}) }),
    ]);
    return { items: items.map((i) => this.mapPortfolio(i as any, true)), pagination: { total, limit: limit || null, offset, hasMore: limit ? offset + items.length < total : false } };
  }

  async featured(query: Record<string, unknown>) {
    const limit = numberValue(query.limit, 6);
    const items = await this.prisma.portfolio_items.findMany({ where: { status: 'published', featured: true, deleted_at: null }, orderBy: [{ sort_order: 'asc' }, { project_date: 'desc' }], take: limit });
    return { items: items.map((i) => this.mapPortfolio(i as any, true)) };
  }

  async categories() {
    const rows = await this.prisma.portfolio_items.groupBy({ by: ['category'], where: { status: 'published', deleted_at: null, category: { not: null } } });
    return rows.map((r) => r.category).filter(Boolean);
  }

  async findBySlug(slug: string) {
    const item = await this.prisma.portfolio_items.findFirst({ where: { slug, status: 'published', deleted_at: null } });
    if (!item) throw new NotFoundException({ message: 'Portfolio item not found' });
    return this.mapPortfolio(item as any);
  }

  async findAllAdmin(query: Record<string, unknown>) {
    const where: any = { deleted_at: null };
    const status = stringValue(query.status);
    const category = stringValue(query.category);
    const search = stringValue(query.search);
    if (status && status !== 'all') where.status = status;
    if (category && category !== 'all') where.category = category;
    if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }, { client_name: { contains: search, mode: 'insensitive' } }];
    const limit = numberValue(query.limit, 50);
    const offset = numberValue(query.offset, 0);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.portfolio_items.count({ where }),
      this.prisma.portfolio_items.findMany({ where, orderBy: { created_at: 'desc' }, skip: offset, take: limit }),
    ]);
    return { items: items.map((i) => this.mapPortfolio(i as any, false, true)), pagination: { total, limit, offset, hasMore: offset + items.length < total } };
  }

  async statsAdmin() {
    const stats = await this.prisma.portfolio_items.groupBy({ by: ['status'], _count: { id: true }, where: { deleted_at: null } });
    const result = { total: 0, published: 0, draft: 0, featured: 0 };
    for (const s of stats) { result.total += s._count.id; if (s.status === 'published') result.published = s._count.id; if (s.status === 'draft') result.draft = s._count.id; }
    const featured = await this.prisma.portfolio_items.count({ where: { deleted_at: null, featured: true } });
    result.featured = featured;
    return result;
  }

  async findOneAdmin(id: number) {
    const item = await this.prisma.portfolio_items.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ message: 'Portfolio item not found' });
    return { item: this.mapPortfolio(item as any, false, true) };
  }

  async create(dto: Record<string, unknown>) {
    const data: any = this.buildPortfolioData(dto);
    const created = await this.prisma.portfolio_items.create({ data });
    return { message: 'Portfolio item created successfully', item: this.mapPortfolio(created as any, false, true) };
  }

  async update(id: number, dto: Record<string, unknown>) {
    const item = await this.prisma.portfolio_items.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ message: 'Portfolio item not found' });
    const data: any = this.buildPortfolioData(dto, true);
    const updated = await this.prisma.portfolio_items.update({ where: { id }, data });
    return { message: 'Portfolio item updated successfully', item: this.mapPortfolio(updated as any, false, true) };
  }

  async remove(id: number) {
    const item = await this.prisma.portfolio_items.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ message: 'Portfolio item not found' });
    await this.prisma.portfolio_items.update({ where: { id }, data: { deleted_at: new Date() } });
    return buildMessageEnvelope('Portfolio item deleted successfully');
  }

  private buildPortfolioData(dto: Record<string, unknown>, partial = false) {
    const title = stringValue(dto.title);
    const slug = stringValue(dto.slug) || (title ? slugify(title) : undefined);
    const data: any = {
      title: partial ? (dto.title !== undefined ? title : undefined) : (title || undefined),
      slug: partial ? (dto.slug !== undefined ? stringValue(dto.slug) : undefined) : slug,
      description: dto.description !== undefined ? stringValue(dto.description) : undefined,
      short_description: dto.short_description !== undefined ? stringValue(dto.short_description) : undefined,
      featured_image: dto.featured_image !== undefined ? stringValue(dto.featured_image) : undefined,
      gallery_images: dto.gallery_images !== undefined ? asJson(dto.gallery_images, []) : undefined,
      client_name: dto.client_name !== undefined ? stringValue(dto.client_name) : undefined,
      project_url: dto.project_url !== undefined ? stringValue(dto.project_url) : undefined,
      project_date: dto.project_date ? new Date(stringValue(dto.project_date)) : undefined,
      technologies: dto.technologies !== undefined ? asJson(dto.technologies, []) : undefined,
      services_provided: dto.services_provided !== undefined ? asJson(dto.services_provided, []) : undefined,
      status: dto.status !== undefined ? stringValue(dto.status, 'draft') : undefined,
      featured: dto.featured !== undefined ? (dto.featured === true) : undefined,
      category: dto.category !== undefined ? stringValue(dto.category) : undefined,
      sort_order: dto.sort_order !== undefined ? numberValue(dto.sort_order) : undefined,
      meta_title: dto.meta_title !== undefined ? stringValue(dto.meta_title) : undefined,
      meta_description: dto.meta_description !== undefined ? stringValue(dto.meta_description) : undefined,
      content_type: dto.content_type !== undefined ? stringValue(dto.content_type, 'portfolio') : undefined,
      updated_at: new Date(),
    };
    if (partial) Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    else { data.created_at = new Date(); data.updated_at = new Date(); }
    return data;
  }

  private mapPortfolio(item: any, list = false, admin = false) {
    const result: any = { ...item };
    result.gallery_images = parseJson(item.gallery_images, []);
    result.technologies = parseJson(item.technologies, []);
    result.services_provided = parseJson(item.services_provided, []);
    if (admin) {
      result.client = item.client_name;
      result.tags = result.technologies;
      result.cover_image = item.featured_image;
      result.live_url = item.project_url;
      result.images = result.gallery_images;
    }
    if (list) { delete result.description; }
    return result;
  }
}
