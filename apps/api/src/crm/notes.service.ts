import { Injectable, NotFoundException } from '@nestjs/common';
import { enum_crm_notes_note_type } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto, UpdateNoteDto } from './dto';
import { asJsonInput, buildLegacyList } from './crm-utils';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    contact_id?: number;
    company_id?: number;
    deal_id?: number;
    activity_id?: number;
    note_type?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { contact_id, company_id, deal_id, activity_id, note_type, page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC' } = query;

    const where: { [key: string]: unknown } = {};
    if (contact_id) where.contact_id = contact_id;
    if (company_id) where.company_id = company_id;
    if (deal_id) where.deal_id = deal_id;
    if (activity_id) where.activity_id = activity_id;
    if (note_type) where.note_type = note_type;

    const orderBy: { [key: string]: 'asc' | 'desc' } = {
      [sortBy || 'created_at']: sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [notes, total] = await Promise.all([
      this.prisma.crm_notes.findMany({
        where,
        include: { profiles: { select: { id: true, first_name: true, last_name: true } } },
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.crm_notes.count({ where }),
    ]);

    return buildLegacyList('notes', notes, total, page, limit);
  }

  async findOne(id: number) {
    const note = await this.prisma.crm_notes.findUnique({
      where: { id },
      include: { profiles: { select: { id: true, first_name: true, last_name: true } } },
    });
    if (!note) throw new NotFoundException('Note not found');
    return { data: note };
  }

  async create(userId: number, dto: CreateNoteDto) {
    const note = await this.prisma.crm_notes.create({
      data: {
        content: dto.content,
        note_type: dto.note_type as unknown as enum_crm_notes_note_type,
        contact_id: dto.contact_id,
        company_id: dto.company_id,
        deal_id: dto.deal_id,
        activity_id: dto.activity_id,
        created_by: userId,
        is_pinned: dto.is_pinned ?? false,
        is_private: dto.is_private ?? false,
        attachments: asJsonInput(dto.attachments),
        mentions: asJsonInput(dto.mentions),
      },
    });

    return this.findOne(note.id);
  }

  async update(id: number, dto: UpdateNoteDto) {
    const existing = await this.prisma.crm_notes.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Note not found');

    const data: Record<string, unknown> = {};
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.note_type !== undefined) data.note_type = dto.note_type;
    if (dto.is_pinned !== undefined) data.is_pinned = dto.is_pinned;
    if (dto.is_private !== undefined) data.is_private = dto.is_private;
    if (dto.attachments !== undefined) data.attachments = asJsonInput(dto.attachments);
    if (dto.mentions !== undefined) data.mentions = asJsonInput(dto.mentions);

    await this.prisma.crm_notes.update({
      where: { id },
      data: data,
    });

    return this.findOne(id);
  }

  async delete(id: number) {
    const existing = await this.prisma.crm_notes.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Note not found');
    await this.prisma.crm_notes.delete({ where: { id } });
    return { message: 'Note deleted successfully' };
  }
}
