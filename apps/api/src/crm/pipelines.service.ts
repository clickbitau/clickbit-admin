import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, enum_crm_pipelines_pipeline_type } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineDto, UpdatePipelineDto, UpdatePipelineStagesDto } from './dto';
import { buildLegacyList } from './crm-utils';

@Injectable()
export class PipelinesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    query: { search?: string; pipeline_type?: string; is_active?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: string },
  ) {
    const { search, pipeline_type, is_active, page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC' } = query;

    const where: { [key: string]: unknown } = {};
    if (pipeline_type) where.pipeline_type = pipeline_type;
    if (is_active !== undefined && is_active !== 'all') where.is_active = is_active === 'true';
    if (search) {
      (where as { OR: unknown[] }).OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: { [key: string]: 'asc' | 'desc' } = {
      [sortBy || 'created_at']: sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [pipelines, total] = await Promise.all([
      this.prisma.crm_pipelines.findMany({
        where,
        include: { crm_pipeline_stages: { orderBy: { position: 'asc' } } },
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.crm_pipelines.count({ where }),
    ]);

    return buildLegacyList('pipelines', pipelines, total, page, limit);
  }

  async findOne(id: number) {
    const pipeline = await this.prisma.crm_pipelines.findUnique({
      where: { id },
      include: { crm_pipeline_stages: { orderBy: { position: 'asc' } }, profiles: { select: { id: true, first_name: true, last_name: true } } },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return { data: pipeline };
  }

  async create(userId: number, dto: CreatePipelineDto) {
    const pipeline = await this.prisma.crm_pipelines.create({
      data: {
        name: dto.name,
        description: dto.description,
        pipeline_type: dto.pipeline_type as unknown as enum_crm_pipelines_pipeline_type,
        currency: dto.currency || 'AUD',
        is_default: dto.is_default ?? false,
        is_active: true,
        created_by: userId,
      } as unknown as Prisma.crm_pipelinesUncheckedCreateInput,
    });

    return this.findOne(pipeline.id);
  }

  async update(id: number, dto: UpdatePipelineDto) {
    const existing = await this.prisma.crm_pipelines.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pipeline not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.pipeline_type !== undefined) data.pipeline_type = dto.pipeline_type as unknown as enum_crm_pipelines_pipeline_type;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.is_default !== undefined) data.is_default = dto.is_default;

    await this.prisma.crm_pipelines.update({
      where: { id },
      data: data as unknown as Prisma.crm_pipelinesUncheckedUpdateInput,
    });

    return this.findOne(id);
  }

  async updateStages(id: number, dto: UpdatePipelineStagesDto) {
    const pipeline = await this.prisma.crm_pipelines.findUnique({ where: { id } });
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    const incoming = dto.stages || [];
    const existingStages = await this.prisma.crm_pipeline_stages.findMany({
      where: { pipeline_id: id },
    });

    const updates: Prisma.PrismaPromise<unknown>[] = [];
    const creates: Prisma.PrismaPromise<unknown>[] = [];
    const usedIds = new Set<number>();

    for (const [index, s] of incoming.entries()) {
      if (s.id) {
        const existing = existingStages.find((es) => es.id === s.id);
        if (!existing) throw new BadRequestException(`Stage ${s.id} not found`);
        usedIds.add(s.id);
        updates.push(
          this.prisma.crm_pipeline_stages.update({
            where: { id: s.id },
            data: {
              name: s.name,
              description: s.description,
              position: s.position ?? index,
              probability: s.probability ?? 0,
              color: s.color,
              is_won: s.is_won ?? false,
              is_lost: s.is_lost ?? false,
              rotting_days: s.rotting_days,
              is_active: s.is_active ?? true,
            } as unknown as Prisma.crm_pipeline_stagesUncheckedUpdateInput,
          }),
        );
      } else {
        creates.push(
          this.prisma.crm_pipeline_stages.create({
            data: {
              pipeline_id: id,
              name: s.name,
              description: s.description,
              position: s.position ?? index,
              probability: s.probability ?? 0,
              color: s.color,
              is_won: s.is_won ?? false,
              is_lost: s.is_lost ?? false,
              rotting_days: s.rotting_days,
              is_active: s.is_active ?? true,
            } as unknown as Prisma.crm_pipeline_stagesUncheckedCreateInput,
          }),
        );
      }
    }

    const deleteIds = existingStages.filter((es) => !usedIds.has(es.id)).map((es) => es.id);
    const deletes: Prisma.PrismaPromise<unknown>[] = deleteIds.length
      ? [this.prisma.crm_pipeline_stages.deleteMany({ where: { id: { in: deleteIds } } })]
      : [];

    await this.prisma.$transaction([...creates, ...updates, ...deletes] as Prisma.PrismaPromise<unknown>[]);

    return this.findOne(id);
  }
}
