import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { asJsonInput, buildDataEnvelope, buildMessageEnvelope, buildListEnvelope, numberValue, profileSelect, stringValue } from './communication-utils';
import { CacheService } from '../redis/cache.service';

const messageInclude = {
  profiles: { select: profileSelect },
  reactions: { include: { profiles: { select: profileSelect } } },
  threads: true,
};

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService,
    private readonly cache?: CacheService) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('messages', ...parts) ?? `messages:` + parts.filter((p) => p !== undefined && p !== null).join(':');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }


  async listChannelMessages(user: Profile, channelId: number, query: Record<string, unknown>) {
    return this.cached(this.cacheKey('listChannelMessages', user.id, channelId, JSON.stringify(query)), async () => {

      const channel = await this.prisma.channels.findUnique({ where: { id: channelId } });
      if (!channel) throw new NotFoundException({ success: false, message: 'Channel not found' });
      await this.assertWorkspaceMember(channel.workspace_id, user.id, user.role);

      const limit = Math.min(Math.max(numberValue(query.limit, 50), 1), 100);
      const before = numberValue(query.before, 0) || undefined;
      const after = numberValue(query.after, 0) || undefined;

      const where: any = { channel_id: channelId, deleted_at: null };
      if (before) where.id = { lt: before };
      else if (after) where.id = { gt: after };

      const messages = await this.prisma.messages.findMany({
        where,
        include: messageInclude as any,
        orderBy: { id: 'desc' },
        take: limit + 1,
      });

      const hasMore = messages.length > limit;
      const returned = hasMore ? messages.slice(0, -1) : messages;
      const reversed = returned.reverse();

      return {
        success: true,
        messages: reversed.map((m) => this.mapMessage(m as any)),
        pagination: { limit, hasMore, hasPrevious: !!before, nextCursor: hasMore ? reversed[reversed.length - 1]?.id : null, previousCursor: reversed[0]?.id || null },
      };


    });
}

  async listDmMessages(user: Profile, dmId: number, query: Record<string, unknown>) {
    return this.cached(this.cacheKey('listDmMessages', user.id, dmId, JSON.stringify(query)), async () => {

      const participant = await this.prisma.direct_message_participants.findFirst({ where: { direct_message_id: dmId, user_id: user.id } });
      if (!participant && user.role !== 'admin') throw new ForbiddenException({ success: false, message: 'You are not a participant in this conversation' });

      const limit = Math.min(Math.max(numberValue(query.limit, 50), 1), 100);
      const before = numberValue(query.before, 0) || undefined;
      const after = numberValue(query.after, 0) || undefined;

      const where: any = { direct_message_id: dmId, deleted_at: null };
      if (before) where.id = { lt: before };
      else if (after) where.id = { gt: after };

      const messages = await this.prisma.messages.findMany({
        where,
        include: messageInclude as any,
        orderBy: { id: 'desc' },
        take: limit + 1,
      });

      const hasMore = messages.length > limit;
      const returned = hasMore ? messages.slice(0, -1) : messages;
      const reversed = returned.reverse();

      return {
        success: true,
        messages: reversed.map((m) => this.mapMessage(m as any)),
        pagination: { limit, hasMore, hasPrevious: !!before, nextCursor: hasMore ? reversed[reversed.length - 1]?.id : null, previousCursor: reversed[0]?.id || null },
      };


    });
}

  async create(user: Profile, dto: Record<string, unknown>) {
    await this.invalidateCache();

    const channelId = dto.channelId ? numberValue(dto.channelId) : undefined;
    const dmId = dto.directMessageId ? numberValue(dto.directMessageId) : undefined;
    const content = stringValue(dto.content).trim();
    const attachments = asJsonInput<unknown[]>(dto.attachments, []);
    const parentId = dto.parentMessageId ? numberValue(dto.parentMessageId) : undefined;

    if ((!content && !attachments.length) || (!channelId && !dmId)) {
      throw new BadRequestException({ success: false, message: 'Message text or attachments are required, and either channelId or directMessageId must be set' });
    }

    if (channelId) {
      const channel = await this.prisma.channels.findUnique({ where: { id: channelId } });
      if (!channel) throw new NotFoundException({ success: false, message: 'Channel not found' });
      await this.assertWorkspaceMember(channel.workspace_id, user.id, user.role);
    } else if (dmId) {
      const participant = await this.prisma.direct_message_participants.findFirst({ where: { direct_message_id: dmId, user_id: user.id } });
      if (!participant && user.role !== 'admin') throw new ForbiddenException({ success: false, message: 'Not authorized to post in this DM' });
    }

    const mentions = this.parseMentions(content);
    const mentionsArray = Array.from(new Set(mentions.map((m) => m.id)));

    const created = await this.prisma.messages.create({
      data: {
        channel_id: channelId || null,
        direct_message_id: dmId || null,
        user_id: user.id,
        content: content || (attachments.length ? '\u200b' : ''),
        attachments,
        reply_to_id: parentId || null,
        mentions: mentionsArray as any,
        mentions_data: mentions.length ? { users: mentions } as any : null,
      } as any,
      include: messageInclude as any,
    });

    if (parentId) {
      await this.upsertThread(parentId, channelId, dmId);
    }

    return buildDataEnvelope(this.mapMessage(created as any));
  }

  async update(user: Profile, messageId: number, dto: Record<string, unknown>) {
    await this.invalidateCache();

    const message = await this.prisma.messages.findUnique({ where: { id: messageId } });
    if (!message || message.deleted_at) throw new NotFoundException({ success: false, message: 'Message not found' });
    if (message.user_id !== user.id && user.role !== 'admin') throw new ForbiddenException({ success: false, message: 'You can only edit your own messages' });

    const content = stringValue(dto.content).trim();
    if (!content) throw new BadRequestException({ success: false, message: 'Content is required' });

    const mentions = this.parseMentions(content);
    const mentionsArray = Array.from(new Set(mentions.map((m) => m.id)));

    const updated = await this.prisma.messages.update({
      where: { id: messageId },
      data: {
        content,
        edited_at: new Date(),
        mentions: mentionsArray as any,
        mentions_data: mentions.length ? { users: mentions } as any : null,
      } as any,
      include: messageInclude as any,
    });

    return buildDataEnvelope(this.mapMessage(updated as any));
  }

  async remove(user: Profile, messageId: number) {
    await this.invalidateCache();

    const message = await this.prisma.messages.findUnique({ where: { id: messageId } });
    if (!message || message.deleted_at) throw new NotFoundException({ success: false, message: 'Message not found' });
    if (message.user_id !== user.id && user.role !== 'admin') throw new ForbiddenException({ success: false, message: 'You can only delete your own messages' });

    await this.prisma.messages.update({ where: { id: messageId }, data: { deleted_at: new Date(), content: '[deleted]' } });
    return buildMessageEnvelope('Message deleted successfully');
  }

  async addReaction(user: Profile, messageId: number, emoji: string) {
    await this.invalidateCache();

    const message = await this.prisma.messages.findUnique({ where: { id: messageId } });
    if (!message || message.deleted_at) throw new NotFoundException({ success: false, message: 'Message not found' });

    await this.prisma.reactions.upsert({
      where: { message_id_user_id_emoji: { message_id: messageId, user_id: user.id, emoji } },
      create: { message_id: messageId, user_id: user.id, emoji },
      update: {},
    });

    return buildMessageEnvelope('Reaction added');
  }

  async removeReaction(user: Profile, messageId: number, emoji: string) {
    await this.invalidateCache();

    await this.prisma.reactions.deleteMany({ where: { message_id: messageId, user_id: user.id, emoji } });
    return buildMessageEnvelope('Reaction removed');
  }

  async getThread(user: Profile, messageId: number) {
    return this.cached(this.cacheKey('getThread', user.id, messageId), async () => {

      const message = await this.prisma.messages.findUnique({ where: { id: messageId } });
      if (!message || message.deleted_at) throw new NotFoundException({ success: false, message: 'Message not found' });

      if (message.channel_id) {
        const channel = await this.prisma.channels.findUnique({ where: { id: message.channel_id } });
        if (channel) await this.assertWorkspaceMember(channel.workspace_id, user.id, user.role);
      } else if (message.direct_message_id) {
        const participant = await this.prisma.direct_message_participants.findFirst({ where: { direct_message_id: message.direct_message_id, user_id: user.id } });
        if (!participant && user.role !== 'admin') throw new ForbiddenException({ success: false, message: 'Not authorized' });
      }

      const replies = await this.prisma.messages.findMany({
        where: { reply_to_id: messageId, deleted_at: null },
        include: messageInclude as any,
        orderBy: { created_at: 'asc' },
      });

      return buildDataEnvelope({ message: this.mapMessage(message as any), replies: replies.map((m) => this.mapMessage(m as any)) });


    });
}

  async search(user: Profile, query: Record<string, unknown>) {
    return this.cached(this.cacheKey('search', user.id, JSON.stringify(query)), async () => {

      const term = stringValue(query.query).toLowerCase();
      const channelId = numberValue(query.channel_id, 0) || undefined;
      const dmId = numberValue(query.direct_message_id, 0) || undefined;

      const where: any = { content: { contains: term, mode: 'insensitive' }, deleted_at: null };
      if (channelId) where.channel_id = channelId;
      if (dmId) where.direct_message_id = dmId;

      const messages = await this.prisma.messages.findMany({ where, include: messageInclude as any, orderBy: { created_at: 'desc' }, take: 50 });
      return buildListEnvelope(messages.map((m) => this.mapMessage(m as any)), messages.length, 50, 0);


    });
}

  private async assertWorkspaceMember(workspaceId: number, userId: number, role?: string) {
    if (role === 'admin') return;
    const member = await this.prisma.workspace_members.findFirst({ where: { workspace_id: workspaceId, user_id: userId } });
    if (!member) throw new ForbiddenException({ success: false, message: 'Not authorized to access this workspace' });
  }

  private async upsertThread(parentMessageId: number, channelId?: number, _dmId?: number) {
    const parent = await this.prisma.messages.findUnique({ where: { id: parentMessageId } });
    if (!parent) return;
    const conversationChannelId = channelId || parent.channel_id;
    if (!conversationChannelId) return;

    await this.prisma.threads.upsert({
      where: { message_id: parentMessageId },
      create: { message_id: parentMessageId, channel_id: conversationChannelId, reply_count: 1, last_reply_at: new Date() },
      update: { reply_count: { increment: 1 }, last_reply_at: new Date() },
    });
  }

  private parseMentions(content: string): { id: number; name: string }[] {
    if (!content) return [];
    const regex = /@([\w.\-]+)/g;
    const users: { id: number; name: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const text = match[1];
      const id = Number(text);
      if (!Number.isNaN(id) && id > 0) users.push({ id, name: `User ${id}` });
    }
    return users;
  }

  private mapMessage(message: any) {
    return {
      ...message,
      author: message.profiles,
      reactions: (message.reactions || []).map((r: any) => ({ ...r, user: r.profiles })),
      thread: message.threads || null,
      profiles: undefined,
    };
  }
}
