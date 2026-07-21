import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildMessageEnvelope, numberValue, stringValue } from './content-utils';
import { CacheService } from '../redis/cache.service';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('team', ...parts) ?? `team:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  async listPublic() {
    return this.cached(this.cacheKey('public'), async () => {
    return this.prisma.teams.findMany({ where: { is_active: true }, orderBy: [{ display_order: 'asc' }, { id: 'asc' }] });
    });
  }

  async findById(id: number) {
    return this.cached(this.cacheKey('detail', id), async () => {
    const member = await this.prisma.teams.findUnique({ where: { id } });
    if (!member) throw new NotFoundException({ message: 'Team member not found' });
    return member;
    });
  }

  async findAllAdmin() {
    return this.cached(this.cacheKey('admin-list'), async () => this.prisma.teams.findMany({ orderBy: [{ display_order: 'asc' }, { id: 'asc' }] }));
  }

  async statsAdmin() {
    return this.cached(this.cacheKey('admin-stats'), async () => {
    const [total, active] = await this.prisma.$transaction([
      this.prisma.teams.count(),
      this.prisma.teams.count({ where: { is_active: true } }),
    ]);
    return { total, active, inactive: total - active };
    });
  }

  async create(dto: Record<string, unknown>) {
    const data: any = {
      name: stringValue(dto.name),
      role: stringValue(dto.role),
      role_label: stringValue(dto.role_label) || null,
      image: stringValue(dto.image) || null,
      email: stringValue(dto.email) || null,
      phone: stringValue(dto.phone) || null,
      bio: stringValue(dto.bio) || null,
      linkedin: stringValue(dto.linkedin) || null,
      display_order: numberValue(dto.display_order, 0),
      is_active: dto.is_active !== false,
      user_id: numberValue(dto.user_id) || null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const created = await this.prisma.teams.create({ data });
    await this.invalidateCache();
    return created;
  }

  async update(id: number, dto: Record<string, unknown>) {
    const member = await this.prisma.teams.findUnique({ where: { id } });
    if (!member) throw new NotFoundException({ message: 'Team member not found' });
    const data: any = {};
    if (dto.name !== undefined) data.name = stringValue(dto.name);
    if (dto.role !== undefined) data.role = stringValue(dto.role);
    if (dto.role_label !== undefined) data.role_label = stringValue(dto.role_label) || null;
    if (dto.image !== undefined) data.image = stringValue(dto.image) || null;
    if (dto.email !== undefined) data.email = stringValue(dto.email) || null;
    if (dto.phone !== undefined) data.phone = stringValue(dto.phone) || null;
    if (dto.bio !== undefined) data.bio = stringValue(dto.bio) || null;
    if (dto.linkedin !== undefined) data.linkedin = stringValue(dto.linkedin) || null;
    if (dto.display_order !== undefined) data.display_order = numberValue(dto.display_order);
    if (dto.is_active !== undefined) data.is_active = dto.is_active === true;
    if (dto.user_id !== undefined) data.user_id = numberValue(dto.user_id) || null;
    data.updated_at = new Date();
    const updated = await this.prisma.teams.update({ where: { id }, data });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return updated;
  }

  async remove(id: number) {
    const member = await this.prisma.teams.findUnique({ where: { id } });
    if (!member) throw new NotFoundException({ message: 'Team member not found' });
    await this.prisma.teams.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildMessageEnvelope('Team member deleted successfully');
  }
}
