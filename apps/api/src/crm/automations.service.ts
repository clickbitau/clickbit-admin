import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAutomationDto, UpdateAutomationDto } from './dto';
import { asJsonInput, buildLegacyList } from './crm-utils';

@Injectable()
export class AutomationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { trigger_type?: string; target_entity?: string; is_active?: boolean; page?: number; limit?: number }) {
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
  }

  async findOne(id: number) {
    const automation = await this.prisma.crm_automations.findUnique({ where: { id } });
    if (!automation) throw new NotFoundException('Automation not found');
    return { automation };
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

    return this.findOne(id);
  }

  async toggle(id: number) {
    const existing = await this.prisma.crm_automations.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Automation not found');

    await this.prisma.crm_automations.update({
      where: { id },
      data: { is_active: !existing.is_active },
    });

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
    return { message: 'Automation deleted successfully' };
  }
}
