import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { buildMessageEnvelope, numberValue, parseJson, slugify, stringValue } from './content-utils';
import { CacheService } from '../redis/cache.service';

const MARKETING_TAG = 'marketing';
const profileSelect = { id: true, first_name: true, last_name: true };

@Injectable()
export class MarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('marketing', ...parts) ?? `marketing:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  async listPublic(query: Record<string, unknown>) {
    return this.cached(this.cacheKey('public', JSON.stringify(query)), async () => {
    const now = new Date();
    const limit = Math.min(numberValue(query.limit, 20), 50);
    const offset = numberValue(query.offset, 0);
    const type = stringValue(query.type);
    const where: any = { status: 'published', deleted_at: null, tags: { contains: MARKETING_TAG, mode: 'insensitive' }, OR: [{ published_at: { lte: now } }, { published_at: null }] };
    if (type) where.categories = { contains: type, mode: 'insensitive' };
    const posts = await this.prisma.blog_posts.findMany({ where, orderBy: [{ featured: 'desc' }, { published_at: 'desc' }], skip: offset, take: limit });
    return posts.map((p: any) => this.mapPost(p));
    });
  }

  async findAllAdmin(query: Record<string, unknown>) {
    return this.cached(this.cacheKey('admin-list', JSON.stringify(query)), async () => {
    const limit = Math.min(numberValue(query.limit, 50), 100);
    const offset = numberValue(query.offset, 0);
    const status = stringValue(query.status);
    const where: any = { deleted_at: null, tags: { contains: MARKETING_TAG, mode: 'insensitive' } };
    if (status) where.status = status;
    const [count, rows] = await this.prisma.$transaction([
      this.prisma.blog_posts.count({ where }),
      this.prisma.blog_posts.findMany({ where, include: { profiles: { select: profileSelect } }, orderBy: { created_at: 'desc' }, skip: offset, take: limit }),
    ]);
    return { posts: rows.map((p: any) => this.mapPost(p)), total: count };
    });
  }

  async statsAdmin() {
    return this.cached(this.cacheKey('admin-stats'), async () => {
    const where: any = { deleted_at: null, tags: { contains: MARKETING_TAG, mode: 'insensitive' } };
    const [total, published, draft] = await this.prisma.$transaction([
      this.prisma.blog_posts.count({ where }),
      this.prisma.blog_posts.count({ where: { ...where, status: 'published' } }),
      this.prisma.blog_posts.count({ where: { ...where, status: 'draft' } }),
    ]);
    return { total, published, draft };
    });
  }

  async findOneAdmin(id: number) {
    return this.cached(this.cacheKey('admin-detail', id), async () => {
    const post = await this.prisma.blog_posts.findUnique({ where: { id }, include: { profiles: { select: profileSelect } } });
    if (!post || post.deleted_at) throw new NotFoundException({ message: 'Marketing post not found' });
    return { post: this.mapPost(post as any) };
    });
  }

  async create(user: Profile, dto: Record<string, unknown>) {
    const title = stringValue(dto.title);
    const slug = stringValue(dto.slug) || slugify(title);
    const tags = parseJson(dto.tags, []);
    if (Array.isArray(tags) && !tags.includes(MARKETING_TAG)) tags.push(MARKETING_TAG);
    const categories = dto.type ? [stringValue(dto.type)] : [];
    const post = await this.prisma.blog_posts.create({
      data: {
        title,
        slug,
        content: stringValue(dto.body || dto.content),
        excerpt: stringValue(dto.body || dto.content).substring(0, 200),
        featured_image: stringValue(dto.image_url) || null,
        status: stringValue(dto.status, 'draft') as any,
        published_at: stringValue(dto.status) === 'published' ? new Date() : null,
        categories: JSON.stringify(categories),
        tags: JSON.stringify(Array.isArray(tags) ? tags : []),
        author_id: user.id,
        created_at: new Date(),
        updated_at: new Date(),
      } as any,
    });
    await this.invalidateCache();
    return this.mapPost(post as any);
  }

  async update(id: number, dto: Record<string, unknown>) {
    const post = await this.prisma.blog_posts.findUnique({ where: { id } });
    if (!post || post.deleted_at) throw new NotFoundException({ message: 'Marketing post not found' });
    const data: any = {};
    if (dto.title !== undefined) data.title = stringValue(dto.title);
    if (dto.slug !== undefined) data.slug = stringValue(dto.slug);
    if (dto.body !== undefined || dto.content !== undefined) {
      const text = stringValue(dto.body !== undefined ? dto.body : dto.content);
      data.content = text;
      data.excerpt = text.substring(0, 200);
    }
    if (dto.image_url !== undefined) data.featured_image = stringValue(dto.image_url) || null;
    if (dto.status !== undefined) {
      data.status = stringValue(dto.status);
      if (data.status === 'published' && post.status !== 'published' && !data.published_at) data.published_at = new Date();
    }
    if (dto.type !== undefined) data.categories = JSON.stringify([stringValue(dto.type)]);
    if (dto.tags !== undefined) {
      const tags = parseJson(dto.tags, []);
      data.tags = JSON.stringify(Array.isArray(tags) ? tags : []);
    }
    data.updated_at = new Date();
    const updated = await this.prisma.blog_posts.update({ where: { id }, data });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('admin-detail', id));
    return this.mapPost(updated as any);
  }

  async remove(id: number) {
    const post = await this.prisma.blog_posts.findUnique({ where: { id } });
    if (!post || post.deleted_at) throw new NotFoundException({ message: 'Marketing post not found' });
    await this.prisma.blog_posts.update({ where: { id }, data: { deleted_at: new Date() } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('admin-detail', id));
    return buildMessageEnvelope('Marketing post deleted');
  }

  private mapPost(post: any) {
    const result: any = { ...post, author: post.profiles };
    result.tags = parseJson(post.tags, []);
    result.categories = parseJson(post.categories, []);
    delete result.profiles;
    return result;
  }
}
