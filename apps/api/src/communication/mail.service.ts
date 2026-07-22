import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { buildDataEnvelope, buildListEnvelope, buildMessageEnvelope, numberValue, stringValue } from './communication-utils';
import { CacheService } from '../redis/cache.service';

const EMAIL_PRESETS: Record<string, any> = {
  hostinger: { imap_host: 'imap.hostinger.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.hostinger.com', smtp_port: 465, smtp_secure: true },
  gmail: { imap_host: 'imap.gmail.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_secure: false },
  outlook: { imap_host: 'outlook.office365.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.office365.com', smtp_port: 587, smtp_secure: false },
  yahoo: { imap_host: 'imap.mail.yahoo.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.mail.yahoo.com', smtp_port: 465, smtp_secure: true },
};

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('mail', ...parts) ?? `mail:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  getPresets() {
    return buildDataEnvelope(EMAIL_PRESETS);
  }

  async listAccounts(user: Profile) {
    return this.cached(this.cacheKey('accounts', user.id), async () => {
    const accounts = await this.prisma.email_accounts.findMany({ where: { profile_id: user.id }, orderBy: { created_at: 'asc' } });
    return buildDataEnvelope(accounts);
    });
  }

  async createAccount(user: Profile, dto: Record<string, unknown>) {
    const presetName = stringValue(dto.preset);
    const preset = presetName ? EMAIL_PRESETS[presetName] : {};
    const email = stringValue(dto.email);
    const username = stringValue(dto.username);
    const password = stringValue(dto.password);
    if (!email || !username || !password) throw new BadRequestException({ success: false, message: 'email, username, and password are required' });

    const created = await this.prisma.email_accounts.create({
      data: {
        id: randomUUID(),
        profile_id: user.id,
        email,
        display_name: stringValue(dto.display_name) || email,
        imap_host: stringValue(dto.imap_host) || preset.imap_host,
        imap_port: numberValue(dto.imap_port, preset.imap_port || 993),
        imap_secure: dto.imap_secure !== undefined ? dto.imap_secure === true : (preset.imap_secure !== undefined ? preset.imap_secure : true),
        smtp_host: stringValue(dto.smtp_host) || preset.smtp_host,
        smtp_port: numberValue(dto.smtp_port, preset.smtp_port || 465),
        smtp_secure: dto.smtp_secure !== undefined ? dto.smtp_secure === true : (preset.smtp_secure !== undefined ? preset.smtp_secure : true),
        username,
        password_encrypted: password,
      },
    });

    await this.invalidateCache();
    return buildDataEnvelope(created);
  }

  async updateAccount(user: Profile, id: string, dto: Record<string, unknown>) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const updated = await this.prisma.email_accounts.update({
      where: { id },
      data: {
        email: dto.email !== undefined ? stringValue(dto.email) : undefined,
        display_name: dto.display_name !== undefined ? stringValue(dto.display_name) : undefined,
        imap_host: dto.imap_host !== undefined ? stringValue(dto.imap_host) : undefined,
        imap_port: dto.imap_port !== undefined ? numberValue(dto.imap_port) : undefined,
        imap_secure: dto.imap_secure !== undefined ? dto.imap_secure === true : undefined,
        smtp_host: dto.smtp_host !== undefined ? stringValue(dto.smtp_host) : undefined,
        smtp_port: dto.smtp_port !== undefined ? numberValue(dto.smtp_port) : undefined,
        smtp_secure: dto.smtp_secure !== undefined ? dto.smtp_secure === true : undefined,
        username: dto.username !== undefined ? stringValue(dto.username) : undefined,
        password_encrypted: dto.password !== undefined ? stringValue(dto.password) : undefined,
        signature_html: dto.signature_html !== undefined ? stringValue(dto.signature_html) : undefined,
        signature_text: dto.signature_text !== undefined ? stringValue(dto.signature_text) : undefined,
        aliases: dto.aliases !== undefined ? (dto.aliases as any) : undefined,
      },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('accounts', user.id));
    return buildDataEnvelope(updated);
  }

  async deleteAccount(user: Profile, id: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    await this.prisma.email_accounts.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('accounts', user.id));
    return buildMessageEnvelope('Account removed');
  }

  testAccount(_user: Profile, _id: string) {
    return Promise.resolve(buildMessageEnvelope('Connection test passed (stub)'));
  }

  async listFolders(user: Profile, accountId: string) {
    return this.cached(this.cacheKey('folders', user.id, accountId), async () => {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const rows = await this.prisma.cached_emails.groupBy({ by: ['folder_path'], where: { account_id: accountId } });
    const folders = rows.map((r) => r.folder_path || 'INBOX');
    if (!folders.includes('INBOX')) folders.unshift('INBOX');
    return buildDataEnvelope(folders.map((f) => ({ path: f, name: f })));
    });
  }

  async listMessages(user: Profile, accountId: string, folderPath: string, query: Record<string, unknown>) {
    return this.cached(this.cacheKey('messages', user.id, accountId, folderPath, JSON.stringify(query)), async () => {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const limit = numberValue(query.limit, 50);
    const offset = numberValue(query.offset, 0);

    const messages = await this.prisma.cached_emails.findMany({
      where: { account_id: accountId, folder_path: folderPath },
      orderBy: { date: 'desc' },
      skip: offset,
      take: limit,
    });

    const count = await this.prisma.cached_emails.count({ where: { account_id: accountId, folder_path: folderPath } });
    return buildListEnvelope(messages, count, limit, offset);
    });
  }

  async getMessage(user: Profile, accountId: string, folderPath: string, uid: string) {
    return this.cached(this.cacheKey('message', user.id, accountId, folderPath, uid), async () => {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const uidInt = parseInt(uid, 10);
    if (Number.isNaN(uidInt)) throw new BadRequestException({ success: false, message: 'Invalid uid' });
    const message = await this.prisma.cached_emails.findFirst({ where: { account_id: accountId, folder_path: folderPath, uid: uidInt } });
    if (!message) throw new NotFoundException({ success: false, message: 'Message not found' });
    return buildDataEnvelope(message);
    });
  }

  async send(user: Profile, accountId: string, dto: Record<string, unknown>) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const toEmail = stringValue(dto.to_email);
    const subject = stringValue(dto.subject);
    if (!toEmail || !subject) throw new BadRequestException({ success: false, message: 'to_email and subject are required' });

    const log = await this.prisma.email_logs.create({
      data: {
        to_email: toEmail,
        to_name: stringValue(dto.to_name) || null,
        from_email: account.email,
        subject,
        status: 'pending',
        triggered_by: user.id,
        metadata: { body_text: stringValue(dto.body_text), body_html: stringValue(dto.body_html), template: stringValue(dto.template) } as any,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return buildMessageEnvelope('Email queued for sending', { email: log });
  }

  async listTemplates(user: Profile) {
    return this.cached(this.cacheKey('templates', user.id), async () => {
    const templates = await this.prisma.email_templates.findMany({ where: { profile_id: user.id }, orderBy: { created_at: 'desc' } });
    return buildDataEnvelope(templates);
    });
  }

  async createTemplate(user: Profile, dto: Record<string, unknown>) {
    const name = stringValue(dto.name);
    if (!name) throw new BadRequestException({ success: false, message: 'Template name is required' });

    const created = await this.prisma.email_templates.create({
      data: { id: randomUUID(), profile_id: user.id, name, subject: stringValue(dto.subject) || null, body_text: stringValue(dto.body_text) || null, body_html: stringValue(dto.body_html) || null },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('templates', user.id));
    return buildDataEnvelope(created);
  }

  async updateTemplate(user: Profile, id: string, dto: Record<string, unknown>) {
    const template = await this.prisma.email_templates.findFirst({ where: { id, profile_id: user.id } });
    if (!template) throw new NotFoundException({ success: false, message: 'Template not found' });

    const updated = await this.prisma.email_templates.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? stringValue(dto.name) : undefined,
        subject: dto.subject !== undefined ? stringValue(dto.subject) : undefined,
        body_text: dto.body_text !== undefined ? stringValue(dto.body_text) : undefined,
        body_html: dto.body_html !== undefined ? stringValue(dto.body_html) : undefined,
      },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('templates', user.id));
    return buildDataEnvelope(updated);
  }

  async deleteTemplate(user: Profile, id: string) {
    const template = await this.prisma.email_templates.findFirst({ where: { id, profile_id: user.id } });
    if (!template) throw new NotFoundException({ success: false, message: 'Template not found' });
    await this.prisma.email_templates.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('templates', user.id));
    return buildMessageEnvelope('Template removed');
  }

  async getSignature(user: Profile, id: string) {
    return this.cached(this.cacheKey('signature', user.id, id), async () => {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id }, select: { signature_html: true, signature_text: true } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    return buildDataEnvelope({ signature_html: account.signature_html, signature_text: account.signature_text });
    });
  }

  async updateSignature(user: Profile, id: string, dto: Record<string, unknown>) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const updated = await this.prisma.email_accounts.update({
      where: { id },
      data: { signature_html: stringValue(dto.signature_html) || null, signature_text: stringValue(dto.signature_text) || null },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('signature', user.id, id));
    return buildDataEnvelope({ signature_html: updated.signature_html, signature_text: updated.signature_text });
  }

  async getAliases(user: Profile, id: string) {
    return this.cached(this.cacheKey('aliases', user.id, id), async () => {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id }, select: { aliases: true } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    return buildDataEnvelope(account.aliases || []);
    });
  }

  async updateAliases(user: Profile, id: string, dto: Record<string, unknown>) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const updated = await this.prisma.email_accounts.update({
      where: { id },
      data: { aliases: (dto.aliases || []) as any },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('aliases', user.id, id));
    return buildDataEnvelope(updated.aliases || []);
  }

  // -------------------------------------------------------------------------
  // Folders
  // -------------------------------------------------------------------------

  async createFolder(user: Profile, accountId: string, folderPath: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    if (!folderPath) throw new BadRequestException({ success: false, message: 'folderPath is required' });
    const name = folderPath.toUpperCase().startsWith('INBOX/') ? folderPath : folderPath.replace(/^\//, '');
    await this.prisma.cached_emails.create({
      data: {
        account_id: accountId,
        folder_path: name,
        uid: await this.nextUid(accountId, name),
        subject: '',
        is_read: true,
        from_address: account.email,
        created_at: new Date(),
        updated_at: new Date(),
      } as any,
    });
    await this.invalidateCache();
    return buildDataEnvelope({ path: name, name });
  }

  async updateFolder(user: Profile, accountId: string, folderPath: string, dto: Record<string, unknown>) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    const newName = stringValue(dto.name)?.replace(/^\//, '');
    if (!newName) throw new BadRequestException({ success: false, message: 'name is required' });
    if (folderPath.toUpperCase() === 'INBOX') throw new BadRequestException({ success: false, message: 'Cannot rename INBOX' });

    await this.prisma.cached_emails.updateMany({
      where: { account_id: accountId, folder_path: folderPath },
      data: { folder_path: newName },
    });
    await this.invalidateCache();
    return buildMessageEnvelope('Folder renamed');
  }

  async deleteFolder(user: Profile, accountId: string, folderPath: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    if (folderPath.toUpperCase() === 'INBOX' || folderPath.toUpperCase() === 'DRAFTS') {
      throw new BadRequestException({ success: false, message: 'Cannot delete protected folder' });
    }
    await this.prisma.cached_emails.deleteMany({ where: { account_id: accountId, folder_path: folderPath } });
    await this.invalidateCache();
    return buildMessageEnvelope('Folder deleted');
  }

  async syncFolder(user: Profile, accountId: string, folderPath: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    await this.invalidateCache();
    return buildMessageEnvelope(`Folder ${folderPath} sync requested`, { accountId, folderPath });
  }

  private async nextUid(accountId: string, folderPath: string): Promise<number> {
    const last = await this.prisma.cached_emails.findFirst({
      where: { account_id: accountId, folder_path: folderPath },
      orderBy: { uid: 'desc' },
      select: { uid: true },
    });
    return (last?.uid || 0) + 1;
  }

  // -------------------------------------------------------------------------
  // Message actions
  // -------------------------------------------------------------------------

  async deleteMessage(user: Profile, accountId: string, folderPath: string, uid: string) {
    const message = await this.findMessage(user, accountId, folderPath, uid);
    await this.prisma.cached_emails.delete({ where: { id: message.id } });
    await this.invalidateCache();
    return buildMessageEnvelope('Message deleted');
  }

  async bulkDeleteMessages(user: Profile, accountId: string, folderPath: string, dto: Record<string, unknown>) {
    await this.findAccount(user, accountId);
    const uids = Array.isArray(dto.uids) ? (dto.uids as number[]) : [];
    if (!uids.length) throw new BadRequestException({ success: false, message: 'uids are required' });
    await this.prisma.cached_emails.deleteMany({ where: { account_id: accountId, folder_path: folderPath, uid: { in: uids } } });
    await this.invalidateCache();
    return buildMessageEnvelope('Messages deleted');
  }

  async bulkReadMessages(user: Profile, accountId: string, folderPath: string, dto: Record<string, unknown>) {
    await this.findAccount(user, accountId);
    const uids = Array.isArray(dto.uids) ? (dto.uids as number[]) : [];
    const isRead = dto.is_read === true || dto.is_read === 'true' ? true : false;
    await this.prisma.cached_emails.updateMany({
      where: { account_id: accountId, folder_path: folderPath, uid: { in: uids } },
      data: { is_read: isRead },
    });
    await this.invalidateCache();
    return buildMessageEnvelope('Messages updated');
  }

  async moveMessage(user: Profile, accountId: string, folderPath: string, uid: string, dto: Record<string, unknown>) {
    const message = await this.findMessage(user, accountId, folderPath, uid);
    const target = stringValue(dto.folder);
    if (!target) throw new BadRequestException({ success: false, message: 'folder is required' });
    const newUid = await this.nextUid(accountId, target);
    await this.prisma.cached_emails.update({
      where: { id: message.id },
      data: { folder_path: target, uid: newUid },
    });
    await this.invalidateCache();
    return buildDataEnvelope({ ...message, folder_path: target, uid: newUid });
  }

  async starMessage(user: Profile, accountId: string, folderPath: string, uid: string, dto: Record<string, unknown>) {
    const message = await this.findMessage(user, accountId, folderPath, uid);
    const starred = dto.starred === true || dto.starred === 'true' ? true : false;
    await this.prisma.cached_emails.update({ where: { id: message.id }, data: { is_starred: starred } });
    await this.invalidateCache();
    return buildDataEnvelope({ ...message, is_starred: starred });
  }

  async markRead(user: Profile, accountId: string, folderPath: string, uid: string, dto: Record<string, unknown>) {
    const message = await this.findMessage(user, accountId, folderPath, uid);
    const isRead = dto.is_read === true || dto.is_read === 'true' ? true : false;
    await this.prisma.cached_emails.update({ where: { id: message.id }, data: { is_read: isRead } });
    await this.invalidateCache();
    return buildDataEnvelope({ ...message, is_read: isRead });
  }

  async searchMessages(user: Profile, accountId: string, folderPath: string, query: Record<string, unknown>) {
    await this.findAccount(user, accountId);
    const term = stringValue(query.q)?.toLowerCase();
    const limit = numberValue(query.limit, 50);
    const offset = numberValue(query.offset, 0);
    const where: any = { account_id: accountId, folder_path: folderPath };
    if (term) {
      where.OR = [
        { subject: { contains: term, mode: 'insensitive' } },
        { from_address: { contains: term, mode: 'insensitive' } },
        { from_name: { contains: term, mode: 'insensitive' } },
        { preview: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [messages, count] = await Promise.all([
      this.prisma.cached_emails.findMany({ where, orderBy: { date: 'desc' }, take: limit, skip: offset }),
      this.prisma.cached_emails.count({ where }),
    ]);
    return buildListEnvelope(messages, count, limit, offset);
  }

  async getAttachment(user: Profile, accountId: string, folderPath: string, uid: string, attachmentId: string) {
    const message = await this.findMessage(user, accountId, folderPath, uid);
    const attachments = (message.attachments_meta as any[]) || [];
    const attachment = attachments.find((a: any) => a.id === attachmentId || a.filename === attachmentId);
    if (!attachment) throw new NotFoundException({ success: false, message: 'Attachment not found' });
    return buildDataEnvelope(attachment);
  }

  async createDraft(user: Profile, accountId: string, dto: Record<string, unknown>) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    const to = stringValue(dto.to_email);
    const subject = stringValue(dto.subject);
    if (!to) throw new BadRequestException({ success: false, message: 'to_email is required' });

    const folderPath = 'Drafts';
    const draft = await this.prisma.cached_emails.create({
      data: {
        account_id: accountId,
        folder_path: folderPath,
        uid: await this.nextUid(accountId, folderPath),
        message_id: randomUUID(),
        subject,
        from_address: account.email,
        from_name: account.display_name || account.email,
        to_addresses: dto.to_email ? [stringValue(dto.to_email)] : [],
        cc_addresses: (dto.cc_emails as string[]) || [],
        preview: stringValue(dto.body_text)?.slice(0, 200) || '',
        html_body: stringValue(dto.body_html) || null,
        text_body: stringValue(dto.body_text) || null,
        is_read: true,
        is_starred: false,
        date: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      } as any,
    });
    await this.invalidateCache();
    return buildDataEnvelope(draft);
  }

  private async findAccount(user: Profile, accountId: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    return account;
  }

  private async findMessage(user: Profile, accountId: string, folderPath: string, uid: string) {
    const account = await this.findAccount(user, accountId);
    const uidInt = parseInt(uid, 10);
    if (Number.isNaN(uidInt)) throw new BadRequestException({ success: false, message: 'Invalid uid' });
    const message = await this.prisma.cached_emails.findFirst({ where: { account_id: accountId, folder_path: folderPath, uid: uidInt } });
    if (!message) throw new NotFoundException({ success: false, message: 'Message not found' });
    return message;
  }
}
