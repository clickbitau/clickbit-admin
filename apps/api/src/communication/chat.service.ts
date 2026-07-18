import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { buildDataEnvelope, buildListEnvelope, buildMessageEnvelope, numberValue, profileSelect, stringValue } from './communication-utils';

const workspaceInclude = {
  workspace_members: { include: { profiles: { select: profileSelect } } },
  profiles: { select: profileSelect },
};

const dmInclude = {
  direct_message_participants: { include: { profiles: { select: profileSelect } } },
  companies: { select: { id: true, name: true } },
};

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async participants(user: Profile) {
    const where: any = { id: { not: user.id }, status: 'active' };
    if (user.role === 'customer') where.role = { in: ['admin', 'manager'] };
    else if (user.role === 'employee') where.role = 'employee';

    const staff = await this.prisma.profiles.findMany({
      where,
      select: profileSelect,
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
      take: 200,
    });

    let clients: any[] = [];
    if (user.role === 'agent') {
      const agentContact = await this.findAgentContactForUser(user.id);
      if (agentContact) {
        const assigned = await this.prisma.contacts.findMany({
          where: { agent_id: agentContact.id, deleted_at: null, user_id: { not: null } },
          select: { user_id: true },
        });
        const userIds = assigned.map((a) => a.user_id).filter(Boolean) as number[];
        clients = await this.prisma.profiles.findMany({ where: { id: { in: userIds }, status: 'active' }, select: profileSelect });
      }
    }

    return buildDataEnvelope([...staff, ...clients]);
  }

  async listWorkspaces(user: Profile) {
    const workspaces = await this.prisma.workspaces.findMany({
      where: { workspace_members: { some: { user_id: user.id } } },
      include: workspaceInclude as any,
      orderBy: { created_at: 'desc' },
    });
    return buildDataEnvelope(workspaces.map((w) => this.mapWorkspace(w as any)));
  }

  async createWorkspace(user: Profile, dto: Record<string, unknown>) {
    const name = stringValue(dto.name);
    if (!name) throw new BadRequestException({ success: false, message: 'Workspace name is required' });

    const created = await this.prisma.workspaces.create({
      data: { name, description: stringValue(dto.description) || null, icon_url: stringValue(dto.icon) || null, created_by: user.id },
      include: workspaceInclude as any,
    });

    await this.prisma.workspace_members.create({ data: { workspace_id: created.id, user_id: user.id, role: 'owner' } });

    return { success: true, workspace: this.mapWorkspace(created as any) };
  }

  async listDirectMessages(user: Profile, query: Record<string, unknown>) {
    const limit = numberValue(query.limit, 50);
    const offset = numberValue(query.offset, 0);

    const participations = await this.prisma.direct_message_participants.findMany({
      where: { user_id: user.id },
      select: { direct_message_id: true },
      orderBy: { direct_message_id: 'desc' },
    });

    const ids = [...new Set(participations.map((p) => Number(p.direct_message_id)))].filter(Number.isFinite);
    if (ids.length === 0) return buildListEnvelope([], 0, limit, offset);

    const dms = await this.prisma.direct_messages.findMany({
      where: { id: { in: ids } },
      include: dmInclude as any,
      orderBy: { updated_at: 'desc' },
      skip: offset,
      take: limit,
    });

    return buildListEnvelope(dms.map((d) => this.mapDm(d as any)), ids.length, limit, offset);
  }

  async createDirectMessage(user: Profile, dto: Record<string, unknown>) {
    const participantIds = Array.isArray(dto.participant_ids) ? dto.participant_ids.map((id: unknown) => numberValue(id)).filter((id: number) => id > 0) : [];
    if (!participantIds.length) throw new BadRequestException({ success: false, message: 'Participant IDs are required' });

    const allIds = [...new Set([...participantIds, user.id])];
    const type = stringValue(dto.type, allIds.length > 2 ? 'group' : 'dm');
    const name = stringValue(dto.name) || (type === 'group' ? 'Group' : undefined);

    const profiles = await this.prisma.profiles.findMany({ where: { id: { in: allIds } } });
    const policyError = await this.assertDmPolicy(user, profiles, type, participantIds);
    if (policyError) throw new ForbiddenException({ success: false, message: policyError });

    const existing = await this.findExistingDm(allIds);
    if (existing) return buildDataEnvelope(this.mapDm(existing as any));

    const created = await this.prisma.direct_messages.create({
      data: { type: type as any, name: name || null },
      include: dmInclude as any,
    });

    await this.prisma.direct_message_participants.createMany({
      data: allIds.map((id) => ({ direct_message_id: created.id, user_id: id })),
    });

    return buildDataEnvelope(this.mapDm(created as any));
  }

  async patchDirectMessage(user: Profile, id: number, dto: Record<string, unknown>) {
    const dm = await this.prisma.direct_messages.findUnique({ where: { id }, include: dmInclude as any });
    if (!dm) throw new NotFoundException({ success: false, message: 'Direct message not found' });

    const updated = await this.prisma.direct_messages.update({
      where: { id },
      data: { name: stringValue(dto.name) || dm.name, avatar_url: stringValue(dto.avatar_url) || dm.avatar_url, updated_at: new Date() },
      include: dmInclude as any,
    });

    return buildDataEnvelope(this.mapDm(updated as any));
  }

  async markDmRead(user: Profile, id: number, _dto: Record<string, unknown>) {
    const participant = await this.prisma.direct_message_participants.findFirst({ where: { direct_message_id: id, user_id: user.id } });
    if (!participant) throw new ForbiddenException({ success: false, message: 'Not a participant' });

    await this.prisma.direct_message_participants.update({
      where: { id: participant.id },
      data: { last_read_at: new Date() },
    });

    return buildMessageEnvelope('Marked as read');
  }

  async listChannels(user: Profile, query: Record<string, unknown>) {
    const workspaceId = numberValue(query.workspace_id, 0);
    if (!workspaceId) throw new BadRequestException({ success: false, message: 'workspace_id is required' });
    await this.assertWorkspaceMember(workspaceId, user.id, user.role);

    const channels = await this.prisma.channels.findMany({ where: { workspace_id: workspaceId }, orderBy: { position: 'asc' } });
    return buildDataEnvelope(channels);
  }

  async createChannel(user: Profile, dto: Record<string, unknown>) {
    const workspaceId = numberValue(dto.workspace_id);
    if (!workspaceId) throw new BadRequestException({ success: false, message: 'workspace_id is required' });
    await this.assertWorkspaceMember(workspaceId, user.id, user.role);

    const name = stringValue(dto.name);
    if (!name) throw new BadRequestException({ success: false, message: 'Channel name is required' });

    const created = await this.prisma.channels.create({
      data: {
        workspace_id: workspaceId,
        name,
        type: stringValue(dto.type, 'text') as any,
        category: stringValue(dto.category) || null,
        description: stringValue(dto.description) || null,
        is_private: dto.is_private === true,
      },
    });

    return buildDataEnvelope(created);
  }

  async markChannelRead(user: Profile, id: number, dto: Record<string, unknown>) {
    const channel = await this.prisma.channels.findUnique({ where: { id } });
    if (!channel) throw new NotFoundException({ success: false, message: 'Channel not found' });
    await this.assertWorkspaceMember(channel.workspace_id, user.id, user.role);

    await this.prisma.channel_read_states.upsert({
      where: { channel_id_user_id: { channel_id: id, user_id: user.id } },
      create: { channel_id: id, user_id: user.id, last_read_at: new Date(), last_read_message_id: numberValue(dto.last_read_message_id, 0) || null },
      update: { last_read_at: new Date(), last_read_message_id: numberValue(dto.last_read_message_id, 0) || null, updated_at: new Date() },
    });

    return buildMessageEnvelope('Marked as read');
  }

  async getPreferences(user: Profile, query: Record<string, unknown>) {
    const conversationType = stringValue(query.conversation_type) as any;
    const conversationId = numberValue(query.conversation_id, 0);
    if (!conversationType || !conversationId) throw new BadRequestException({ success: false, message: 'conversation_type and conversation_id are required' });

    const prefs = await this.prisma.conversation_preferences.findFirst({ where: { user_id: user.id, conversation_type: conversationType, conversation_id: conversationId } });
    return buildDataEnvelope(prefs);
  }

  async savePreferences(user: Profile, dto: Record<string, unknown>) {
    const conversationType = stringValue(dto.conversation_type) as any;
    const conversationId = numberValue(dto.conversation_id);
    if (!conversationType || !conversationId) throw new BadRequestException({ success: false, message: 'conversation_type and conversation_id are required' });

    const prefs = await this.prisma.conversation_preferences.upsert({
      where: { user_id_conversation_type_conversation_id: { user_id: user.id, conversation_type: conversationType, conversation_id: conversationId } },
      create: {
        user_id: user.id,
        conversation_type: conversationType,
        conversation_id: conversationId,
        is_muted: dto.is_muted === true,
        notification_level: stringValue(dto.notification_level, 'all') as any,
        sound_enabled: dto.sound_enabled !== false,
      },
      update: {
        is_muted: dto.is_muted === true,
        notification_level: stringValue(dto.notification_level, 'all') as any,
        sound_enabled: dto.sound_enabled !== false,
      },
    });

    return buildDataEnvelope(prefs);
  }

  private async assertWorkspaceMember(workspaceId: number, userId: number, role?: string) {
    if (role === 'admin') return;
    const member = await this.prisma.workspace_members.findFirst({ where: { workspace_id: workspaceId, user_id: userId } });
    if (!member) throw new ForbiddenException({ success: false, message: 'Not authorized to access this workspace' });
  }

  private async findAgentContactForUser(userId: number) {
    const agentContact = await this.prisma.contacts.findFirst({
      where: { user_id: userId, deleted_at: null },
      orderBy: { updated_at: 'desc' },
    });
    return agentContact;
  }

  private async assertDmPolicy(actor: Profile, profiles: any[], type: string, participantIds: number[]) {
    if (type === 'group' && !['admin', 'manager'].includes(actor.role)) return 'Only admins and managers can create group chats';

    const others = profiles.filter((p) => p.id !== actor.id);
    if (participantIds.length > 1 && type !== 'group' && others.length > 1) return 'For more than one other person, create a group chat';

    if (actor.role === 'customer') {
      for (const t of others) if (!['admin', 'manager'].includes(t.role)) return 'You can only message admins and managers';
    } else if (actor.role === 'employee') {
      for (const t of others) if (t.role !== 'employee') return 'Employees can only message other employees';
    } else if (actor.role === 'agent') {
      const agentContact = await this.findAgentContactForUser(actor.id);
      for (const t of others) {
        if (['admin', 'manager'].includes(t.role)) continue;
        if (!agentContact) return 'You can only message admins and managers until your agent profile is set up';
        const assigned = await this.prisma.contacts.findFirst({ where: { agent_id: agentContact.id, user_id: t.id, deleted_at: null } });
        if (!assigned) return 'You can only message your assigned company contacts or admins and managers';
      }
    }
    return null;
  }

  private async findExistingDm(userIds: number[]) {
    if (userIds.length !== 2) return null;
    const dms = await this.prisma.direct_messages.findMany({
      where: { type: 'dm', direct_message_participants: { every: { user_id: { in: userIds } } } },
      include: { direct_message_participants: true },
      take: 20,
    });
    return dms.find((dm) => dm.direct_message_participants.length === 2 && dm.direct_message_participants.every((p) => userIds.includes(p.user_id))) || null;
  }

  private mapWorkspace(w: any) {
    return {
      ...w,
      members: (w.workspace_members || []).map((m: any) => ({ ...m, user: m.profiles, profiles: undefined })),
      owner: w.profiles,
      workspace_members: undefined,
      profiles: undefined,
    };
  }

  private mapDm(d: any) {
    return {
      ...d,
      participants: (d.direct_message_participants || []).map((p: any) => ({ ...p, user: p.profiles, profiles: undefined })),
      company: d.companies,
      direct_message_participants: undefined,
      companies: undefined,
    };
  }
}
