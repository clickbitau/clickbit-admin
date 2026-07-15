import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto, UpdateActivityDto, CompleteActivityDto } from './dto';
import { asJsonInput, buildLegacyList, safeDate } from './crm-utils';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    activity_type?: string;
    status?: string;
    owner_id?: number;
    assigned_to?: number;
    contact_id?: number;
    company_id?: number;
    deal_id?: number;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const {
      activity_type,
      status,
      owner_id,
      assigned_to,
      contact_id,
      company_id,
      deal_id,
      date_from,
      date_to,
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = query;

    const where: { [key: string]: unknown } = {};
    if (activity_type) where.activity_type = activity_type;
    if (status) where.status = status;
    if (owner_id) where.owner_id = owner_id;
    if (assigned_to) where.assigned_to = assigned_to;
    if (contact_id) where.contact_id = contact_id;
    if (company_id) where.company_id = company_id;
    if (deal_id) where.deal_id = deal_id;
    if (date_from || date_to) {
      where.due_date = {};
      if (date_from) (where.due_date as { gte: Date }).gte = new Date(date_from);
      if (date_to) (where.due_date as { lte: Date }).lte = new Date(date_to);
    }

    const orderBy: { [key: string]: 'asc' | 'desc' } = {
      [sortBy || 'created_at']: sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [activities, total] = await Promise.all([
      this.prisma.crm_activities.findMany({
        where,
        include: {
          profiles_crm_activities_owner_idToprofiles: { select: { id: true, first_name: true, last_name: true } },
          profiles_crm_activities_assigned_toToprofiles: { select: { id: true, first_name: true, last_name: true } },
        },
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.crm_activities.count({ where }),
    ]);

    return buildLegacyList('activities', activities, total, page, limit);
  }

  async findOne(id: number) {
    const activity = await this.prisma.crm_activities.findUnique({
      where: { id },
      include: {
        profiles_crm_activities_owner_idToprofiles: { select: { id: true, first_name: true, last_name: true } },
        profiles_crm_activities_assigned_toToprofiles: { select: { id: true, first_name: true, last_name: true } },
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return { data: activity };
  }

  async create(userId: number, dto: CreateActivityDto) {
    const activity = await this.prisma.crm_activities.create({
      data: {
        activity_type: dto.activity_type,
        subject: dto.subject,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        due_date: safeDate(dto.due_date),
        contact_id: dto.contact_id,
        company_id: dto.company_id,
        deal_id: dto.deal_id,
        owner_id: dto.owner_id || userId,
        assigned_to: dto.assigned_to,
        created_by: userId,
      },
    });

    return this.findOne(activity.id);
  }

  async update(id: number, dto: UpdateActivityDto) {
    const existing = await this.prisma.crm_activities.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Activity not found');

    const data: Record<string, unknown> = {};
    const dtoRecord = dto as unknown as Record<string, unknown>;
    const scalarFields = [
      'activity_type',
      'subject',
      'description',
      'status',
      'priority',
      'duration_minutes',
      'contact_id',
      'company_id',
      'deal_id',
      'owner_id',
      'assigned_to',
      'call_direction',
      'call_outcome',
      'location',
      'meeting_link',
      'email_subject',
      'email_body',
      'outcome',
      'is_pinned',
      'is_recurring',
      'parent_activity_id',
    ];

    for (const field of scalarFields) {
      if (dtoRecord[field] !== undefined) data[field] = dtoRecord[field];
    }

    if (dto.due_date !== undefined) data.due_date = safeDate(dto.due_date);
    if (dto.email_sent_at !== undefined) data.email_sent_at = safeDate(dto.email_sent_at);
    if (dto.email_opened_at !== undefined) data.email_opened_at = safeDate(dto.email_opened_at);
    if (dto.email_clicked_at !== undefined) data.email_clicked_at = safeDate(dto.email_clicked_at);
    if (dto.reminder_at !== undefined) data.reminder_at = safeDate(dto.reminder_at);
    if (dto.completed_at !== undefined) data.completed_at = safeDate(dto.completed_at);

    if (dto.attendees !== undefined) data.attendees = asJsonInput(dto.attendees);
    if (dto.attachments !== undefined) data.attachments = asJsonInput(dto.attachments);
    if (dto.custom_fields !== undefined) data.custom_fields = asJsonInput(dto.custom_fields);
    if (dto.recurrence_pattern !== undefined) data.recurrence_pattern = asJsonInput(dto.recurrence_pattern);

    await this.prisma.crm_activities.update({
      where: { id },
      data: data,
    });

    return this.findOne(id);
  }

  async complete(id: number, dto: CompleteActivityDto) {
    const existing = await this.prisma.crm_activities.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Activity not found');

    await this.prisma.crm_activities.update({
      where: { id },
      data: {
        status: 'completed',
        completed_at: new Date(),
        outcome: dto.outcome,
      },
    });

    return this.findOne(id);
  }

  async delete(id: number) {
    const existing = await this.prisma.crm_activities.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Activity not found');
    await this.prisma.crm_activities.delete({ where: { id } });
    return { message: 'Activity deleted successfully' };
  }
}
