import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildMessageEnvelope, numberValue, stringValue } from './content-utils';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic() {
    return this.prisma.teams.findMany({ where: { is_active: true }, orderBy: [{ display_order: 'asc' }, { id: 'asc' }] });
  }

  async findById(id: number) {
    const member = await this.prisma.teams.findUnique({ where: { id } });
    if (!member) throw new NotFoundException({ message: 'Team member not found' });
    return member;
  }

  async findAllAdmin() {
    return this.prisma.teams.findMany({ orderBy: [{ display_order: 'asc' }, { id: 'asc' }] });
  }

  async statsAdmin() {
    const [total, active] = await this.prisma.$transaction([
      this.prisma.teams.count(),
      this.prisma.teams.count({ where: { is_active: true } }),
    ]);
    return { total, active, inactive: total - active };
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
    return this.prisma.teams.create({ data });
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
    return this.prisma.teams.update({ where: { id }, data });
  }

  async remove(id: number) {
    const member = await this.prisma.teams.findUnique({ where: { id } });
    if (!member) throw new NotFoundException({ message: 'Team member not found' });
    await this.prisma.teams.delete({ where: { id } });
    return buildMessageEnvelope('Team member deleted successfully');
  }
}
