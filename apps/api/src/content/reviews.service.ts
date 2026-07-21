import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildMessageEnvelope, numberValue, stringValue } from './content-utils';
import { CacheService } from '../redis/cache.service';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('reviews', ...parts) ?? `reviews:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  async listPublic(query: Record<string, unknown>) {
    return this.cached(this.cacheKey('public', JSON.stringify(query)), async () => {
    const featured = stringValue(query.featured) === 'true';
    const limit = numberValue(query.limit, 0);
    const where: any = { status: 'approved' };
    if (featured) where.is_featured = true;
    return this.prisma.reviews.findMany({ where, orderBy: { created_at: 'desc' }, ...(limit ? { take: limit } : {}) });
    });
  }

  async createPublic(dto: Record<string, unknown>) {
    const name = stringValue(dto.name);
    const reviewText = stringValue(dto.review_text);
    const rating = numberValue(dto.rating, 0);
    if (!name || !reviewText || !rating) throw new BadRequestException({ message: 'Name, review text, and rating are required.' });
    const review = await this.prisma.reviews.create({
      data: {
        name,
        email: stringValue(dto.email) || null,
        company: stringValue(dto.company) || null,
        position: stringValue(dto.position) || null,
        rating,
        review_text: reviewText,
        service_type: stringValue(dto.service_type) || null,
        project_type: stringValue(dto.project_type) || null,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    await this.invalidateCache();
    return { message: 'Review submitted successfully! It will be reviewed before being published.', review: { id: review.id, name: review.name, rating: review.rating, status: review.status } };
  }

  async findOneAdmin(id: number) {
    return this.cached(this.cacheKey('detail', id), async () => {
    const review = await this.prisma.reviews.findUnique({ where: { id } });
    if (!review) throw new NotFoundException({ message: 'Review not found' });
    return { success: true, data: review };
    });
  }

  async findAllAdmin(query: Record<string, unknown>) {
    return this.cached(this.cacheKey('admin-list', JSON.stringify(query)), async () => {
    const page = numberValue(query.page, 1);
    const limit = numberValue(query.limit, 20);
    const offset = (page - 1) * limit;
    const status = stringValue(query.status);
    const where: any = {};
    if (status && status !== 'all') where.status = status;
    const [count, reviews] = await this.prisma.$transaction([
      this.prisma.reviews.count({ where }),
      this.prisma.reviews.findMany({ where, orderBy: { created_at: 'desc' }, skip: offset, take: limit }),
    ]);
    const stats = await this.stats();
    return { reviews, pagination: { currentPage: page, totalPages: Math.ceil(count / limit) || 1, totalItems: count, itemsPerPage: limit }, stats };
    });
  }

  async updateStatus(id: number, status: string) {
    if (!['approved', 'rejected', 'pending'].includes(status)) throw new BadRequestException({ message: 'Invalid status' });
    const review = await this.prisma.reviews.findUnique({ where: { id } });
    if (!review) throw new NotFoundException({ message: 'Review not found' });
    const data: any = { status };
    if (status === 'approved') { data.approved_at = new Date(); data.approved_by = null; }
    const updated = await this.prisma.reviews.update({ where: { id }, data: { ...data, updated_at: new Date() } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: `Review ${status} successfully`, review: updated };
  }

  async update(id: number, dto: Record<string, unknown>) {
    const review = await this.prisma.reviews.findUnique({ where: { id } });
    if (!review) throw new NotFoundException({ message: 'Review not found' });
    const data: any = {};
    if (dto.name !== undefined) data.name = stringValue(dto.name);
    if (dto.review_text !== undefined) data.review_text = stringValue(dto.review_text);
    if (dto.status !== undefined) data.status = stringValue(dto.status);
    if (dto.is_featured !== undefined) data.is_featured = dto.is_featured === true;
    if (dto.display_order !== undefined) data.display_order = numberValue(dto.display_order);
    data.updated_at = new Date();
    const updated = await this.prisma.reviews.update({ where: { id }, data });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Review updated successfully', review: updated };
  }

  async remove(id: number) {
    const review = await this.prisma.reviews.findUnique({ where: { id } });
    if (!review) throw new NotFoundException({ message: 'Review not found' });
    await this.prisma.reviews.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildMessageEnvelope('Review deleted successfully');
  }

  async stats() {
    return this.cached(this.cacheKey('stats'), async () => {
    const result = { total: 0, pending: 0, approved: 0, rejected: 0, featured: 0, averageRating: 0 };
    let totalRating = 0; let ratedCount = 0;
    const all = await this.prisma.reviews.findMany({ select: { status: true, rating: true, is_featured: true } });
    for (const r of all) {
      result.total++;
      if (r.status === 'pending') result.pending++;
      if (r.status === 'approved') result.approved++;
      if (r.status === 'rejected') result.rejected++;
      if (r.is_featured) result.featured++;
      if (r.rating) { totalRating += r.rating; ratedCount++; }
    }
    result.averageRating = ratedCount ? Math.round((totalRating / ratedCount) * 10) / 10 : 0;
    return result;
    });
  }
}
