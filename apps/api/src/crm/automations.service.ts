import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAutomationDto, UpdateAutomationDto } from './dto';
import { asJsonInput, buildLegacyList } from './crm-utils';
import { CacheService } from '../redis/cache.service';

@Injectable()
export class AutomationsService {
  constructor(
    private prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('automations', ...parts) ?? `automations:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  async findAll(query: { trigger_type?: string; target_entity?: string; is_active?: boolean; page?: number; limit?: number }) {
    return this.cached(this.cacheKey('list', JSON.stringify(query)), async () => {
    const { trigger_type, target_entity, is_active, page = 1, limit = 50 } = query;

    const where: { [key: string]: unknown } = {};
    if (trigger_type) where.trigger_type = trigger_type;
    if (target_entity) where.target_entity = target_entity;
    if (is_active !== undefined) where.is_active = is_active;

    const [automations, total] = await Promise.all([
      this.prisma.crm_automations.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.crm_automations.count({ where }),
    ]);

    return buildLegacyList('automations', automations, total, page, limit);
    });
  }

  async findOne(id: number) {
    return this.cached(this.cacheKey('detail', id), async () => {
    const automation = await this.prisma.crm_automations.findUnique({ where: { id } });
    if (!automation) throw new NotFoundException('Automation not found');
    return { automation };
    });
  }

  async create(userId: number, dto: CreateAutomationDto) {
    const automation = await this.prisma.crm_automations.create({
      data: {
        name: dto.name,
        description: dto.description,
        trigger_type: dto.trigger_type,
        trigger_conditions: asJsonInput(dto.trigger_conditions),
        action_type: dto.action_type,
        action_config: asJsonInput(dto.action_config),
        target_entity: dto.target_entity,
        delay_minutes: dto.delay_minutes ?? 0,
        is_active: dto.is_active ?? true,
        created_by: userId,
      },
    });

    await this.invalidateCache();
    return this.findOne(automation.id);
  }

  async update(id: number, dto: UpdateAutomationDto) {
    const existing = await this.prisma.crm_automations.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Automation not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.trigger_type !== undefined) data.trigger_type = dto.trigger_type;
    if (dto.trigger_conditions !== undefined) data.trigger_conditions = asJsonInput(dto.trigger_conditions);
    if (dto.action_type !== undefined) data.action_type = dto.action_type;
    if (dto.action_config !== undefined) data.action_config = asJsonInput(dto.action_config);
    if (dto.target_entity !== undefined) data.target_entity = dto.target_entity;
    if (dto.delay_minutes !== undefined) data.delay_minutes = dto.delay_minutes;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    await this.prisma.crm_automations.update({
      where: { id },
      data: data,
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return this.findOne(id);
  }

  async toggle(id: number) {
    const existing = await this.prisma.crm_automations.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Automation not found');

    await this.prisma.crm_automations.update({
      where: { id },
      data: { is_active: !existing.is_active },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return this.findOne(id);
  }

  async test(id: number) {
    const existing = await this.prisma.crm_automations.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Automation not found');

    return {
      message: 'Automation test executed',
      automation_id: id,
      action_type: existing.action_type,
      status: 'simulated',
    };
  }

  async delete(id: number) {
    const existing = await this.prisma.crm_automations.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Automation not found');
    await this.prisma.crm_automations.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return { message: 'Automation deleted successfully' };
  }
}
