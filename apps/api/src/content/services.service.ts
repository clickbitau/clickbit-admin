import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { asJson, buildMessageEnvelope, numberValue, parseJson, slugify, stringValue } from './content-utils';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: Record<string, unknown>, mode?: string) {
    const services = await this.prisma.services.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    const parsed = services.map((s) => this.mapService(s as any, mode === 'light'));
    return mode === 'light' ? parsed : parsed;
  }

  async byCategory() {
    const services = await this.prisma.services.findMany({ where: { is_active: true, deleted_at: null }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    const grouped: Record<string, any> = {};
    for (const s of services) {
      const cat = stringValue(s.category, 'General');
      if (!grouped[cat]) grouped[cat] = { name: cat, slug: slugify(cat), items: [] };
      grouped[cat].items.push({ name: s.name, desc: s.description, href: `/services/${s.slug}`, popular: s.is_popular, slug: s.slug });
    }
    return grouped;
  }

  async forProjectForm() {
    const services = await this.prisma.services.findMany({ where: { is_active: true, deleted_at: null }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    const formatted: Record<string, any> = {};
    for (const s of services) {
      const pricing = parseJson(s.pricing, { tiers: [] });
      const featureCategories: any[] = [];
      if (pricing?.tiers?.length) {
        featureCategories.push({
          id: 'pricing-tier', name: 'Select Package',
          features: pricing.tiers.map((tier: any, i: number) => ({
            id: `${s.slug}-tier-${i}`, name: tier.name,
            description: tier.subtitle || '',
            price: tier.price === 'Custom' ? 0 : numberValue((tier.price || '').replace(/[^0-9.]/g, ''))
          }))
        });
        const additional: any[] = [];
        for (const tier of pricing.tiers) {
          for (const f of tier.features || []) {
            if (!additional.find((x) => x.name === f)) {
              additional.push({ id: `${s.slug}-feature-${additional.length}`, name: f, description: 'Optional add-on feature', price: 500 });
            }
          }
        }
        if (additional.length) featureCategories.push({ id: 'additional-features', name: 'Additional Features', features: additional.slice(0, 5) });
      }
      formatted[s.slug] = {
        id: s.slug, name: s.name, description: s.description, category: s.category,
        featureCategories: featureCategories.length ? featureCategories : [{ id: 'basic-package', name: 'Basic Package', features: [{ id: `${s.slug}-basic`, name: s.name, description: s.description, price: 5000 }] }]
      };
    }
    return formatted;
  }

  async productMapping() {
    const services = await this.prisma.services.findMany({ where: { is_active: true, deleted_at: null }, orderBy: { name: 'asc' } });
    const serviceToProductMapping: Record<string, any> = {};
    const products: any[] = [];
    let productId = 1;
    for (const s of services) {
      const pricing = parseJson(s.pricing, { tiers: [] });
      if (!pricing?.tiers?.length) continue;
      serviceToProductMapping[s.slug] = {};
      for (const tier of pricing.tiers) {
        const price = tier.price === 'Custom' ? 0 : numberValue((tier.price || '').replace(/[^0-9.]/g, ''));
        const productSlug = `${s.slug}-${tier.name.toLowerCase().replace(/\s+/g, '-')}`;
        serviceToProductMapping[s.slug][tier.name] = { productSlug, productName: `${s.name} - ${tier.name}`, price, minQuantity: 1 };
        products.push({ id: productId, name: `${s.name} - ${tier.name}`, slug: productSlug, price, serviceSlug: s.slug, tierName: tier.name, minQuantity: 1 });
        productId++;
      }
    }
    return { generatedAt: new Date().toISOString(), totalProducts: products.length, serviceToProductMapping, products };
  }

  async findBySlug(slug: string) {
    const s = await this.prisma.services.findFirst({ where: { slug, deleted_at: null } });
    if (!s) throw new NotFoundException({ message: 'Service not found' });
    return this.mapService(s as any);
  }

  async findAllAdmin(query: Record<string, unknown>) {
    const where: any = { deleted_at: null };
    const status = stringValue(query.status);
    const category = stringValue(query.category);
    const search = stringValue(query.search);
    if (status && status !== 'all') where.is_active = status === 'published' ? true : false;
    if (category && category !== 'all') where.category = category;
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }];
    const limit = numberValue(query.limit, 50);
    const offset = numberValue(query.offset, 0);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.services.count({ where }),
      this.prisma.services.findMany({ where, orderBy: { created_at: 'desc' }, skip: offset, take: limit }),
    ]);
    return { items: items.map((s) => this.mapService(s as any)), pagination: { total, limit, offset, hasMore: offset + items.length < total } };
  }

  async statsAdmin() {
    const [total, active, inactive, popular] = await this.prisma.$transaction([
      this.prisma.services.count({ where: { deleted_at: null } }),
      this.prisma.services.count({ where: { deleted_at: null, is_active: true } }),
      this.prisma.services.count({ where: { deleted_at: null, is_active: false } }),
      this.prisma.services.count({ where: { deleted_at: null, is_popular: true } }),
    ]);
    return { total, active, inactive, popular };
  }

  async findOneAdmin(id: number) {
    const s = await this.prisma.services.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ message: 'Service not found' });
    return { item: this.mapService(s as any) };
  }

  async create(dto: Record<string, unknown>) {
    const data: any = this.buildServiceData(dto);
    const created = await this.prisma.services.create({ data });
    return { message: 'Service created successfully', item: this.mapService(created as any) };
  }

  async update(id: number, dto: Record<string, unknown>) {
    const s = await this.prisma.services.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ message: 'Service not found' });
    const data: any = this.buildServiceData(dto, true);
    const updated = await this.prisma.services.update({ where: { id }, data });
    return { message: 'Service updated successfully', item: this.mapService(updated as any) };
  }

  async remove(id: number) {
    const s = await this.prisma.services.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ message: 'Service not found' });
    await this.prisma.services.update({ where: { id }, data: { deleted_at: new Date() } });
    return buildMessageEnvelope('Service deleted successfully');
  }

  private buildServiceData(dto: Record<string, unknown>, partial = false) {
    const name = stringValue(dto.name);
    const slug = stringValue(dto.slug) || (name ? slugify(name) : undefined);
    const data: any = {
      name: partial ? (dto.name !== undefined ? name : undefined) : (name || undefined),
      slug: partial ? (dto.slug !== undefined ? stringValue(dto.slug) : undefined) : slug,
      description: dto.description !== undefined ? stringValue(dto.description) : undefined,
      category: dto.category !== undefined ? stringValue(dto.category) : undefined,
      header_image: dto.header_image !== undefined ? stringValue(dto.header_image) : undefined,
      features: dto.features !== undefined ? asJson(dto.features, {}) : undefined,
      pricing: dto.pricing !== undefined ? asJson(dto.pricing, {}) : undefined,
      sections: dto.sections !== undefined ? asJson(dto.sections, {}) : undefined,
      is_popular: dto.is_popular !== undefined ? (dto.is_popular === true) : undefined,
      is_active: dto.is_active !== undefined ? (dto.is_active !== false) : undefined,
      updated_at: new Date(),
    };
    if (partial) {
      Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    } else {
      data.created_at = new Date();
      data.updated_at = new Date();
    }
    return data;
  }

  private mapService(s: any, light = false) {
    const result: any = { ...s };
    result.features = parseJson(s.features, []);
    result.pricing = parseJson(s.pricing, {});
    result.sections = parseJson(s.sections, []);
    if (light) {
      delete result.features; delete result.pricing; delete result.sections; delete result.header_image;
    }
    return result;
  }
}
