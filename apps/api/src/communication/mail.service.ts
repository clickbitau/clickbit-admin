import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { buildDataEnvelope, buildListEnvelope, buildMessageEnvelope, numberValue, stringValue } from './communication-utils';
import { CacheService } from '../redis/cache.service';
import { MailImapService } from './mail-imap.service';
import {
  HostingerMailClient,
  HostingerFolder,
  HostingerMessage,
  HostingerMessageText,
  HostingerSendRequest,
  HostingerAddress,
} from './hostinger-mail.client';

const EMAIL_PRESETS: Record<string, any> = {
  hostinger: { imap_host: 'imap.hostinger.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.hostinger.com', smtp_port: 465, smtp_secure: true },
  gmail: { imap_host: 'imap.gmail.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_secure: false },
  outlook: { imap_host: 'outlook.office365.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.office365.com', smtp_port: 587, smtp_secure: false },
  yahoo: { imap_host: 'imap.mail.yahoo.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.mail.yahoo.com', smtp_port: 465, smtp_secure: true },
};

@Injectable()
export class MailService {
  private readonly hostinger = new HostingerMailClient();

  constructor(
    private readonly prisma: PrismaService,
    private readonly imap: MailImapService,
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

  private accountWhere(user: Profile): any {
    if (user.role === 'admin') return {};
    const or: any[] = [{ profile_id: user.id }];
    if (user.role === 'manager') {
      or.push({ shared_with_users: { array_contains: user.id } });
      or.push({ shared_with_roles: { array_contains: 'manager' } });
    } else {
      or.push({ shared_with_users: { array_contains: user.id } });
      or.push({ shared_with_roles: { array_contains: user.role } });
    }
    return { OR: or };
  }

  private sanitizeAccount(account: any): any {
    const sanitized = { ...account };
    delete sanitized.password_encrypted;
    delete sanitized.api_token_encrypted;
    return sanitized;
  }

  private async findAccount(user: Profile, accountId: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, ...this.accountWhere(user) } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    return account;
  }

  private async findOwnedAccount(user: Profile, accountId: string) {
    const where: any = { id: accountId };
    if (user.role !== 'admin') where.profile_id = user.id;
    const account = await this.prisma.email_accounts.findFirst({ where });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    return account;
  }

  private getHostingerToken(account: any): string {
    if (account.provider !== 'hostinger_rest') throw new BadRequestException({ success: false, message: 'Not a Hostinger REST account' });
    const token = this.imap.decryptPassword(account.api_token_encrypted || '');
    if (!token) throw new BadRequestException({ success: false, message: 'Hostinger API token is missing' });
    return token;
  }

  private asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : String(v))).filter(Boolean);
    if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  }

  private asAddressList(value?: HostingerAddress[]): any[] {
    if (!value || !Array.isArray(value)) return [];
    return value
      .filter((a) => a?.address)
      .map((a) => (a.name ? { name: a.name, email: a.address } : a.address));
  }

  private asAttachmentMeta(value?: any[]): any[] {
    if (!value || !Array.isArray(value)) return [];
    return value.map((a) => ({
      id: a.id,
      filename: a.filename || 'unnamed',
      contentType: a.contentType || 'application/octet-stream',
      size: a.sizeBytes || 0,
      inline: a.inline || false,
      contentId: a.contentId || null,
    }));
  }

  private parseHostingerFlags(msg: HostingerMessage) {
    const flags = Array.isArray(msg.flags) ? (msg.flags) : [];
    const isRead = msg.unseen === false || flags.includes('\\Seen');
    const isStarred = flags.includes('\\Flagged');
    return { flags, isRead, isStarred };
  }

  private baseCacheData(accountId: string, folderPath: string, msg: HostingerMessage, body?: HostingerMessageText): any {
    const { flags, isRead, isStarred } = this.parseHostingerFlags(msg);
    const from = msg.from || {};
    const date = msg.date ? new Date(msg.date) : new Date();
    const preview = body?.text ? body.text.slice(0, 200) : (msg.subject || '');
    return {
      account_id: accountId,
      folder_path: folderPath,
      uid: msg.uid,
      message_id: msg.messageId || null,
      subject: msg.subject || '(No Subject)',
      from_address: from.address || null,
      from_name: from.name || null,
      to_addresses: this.asAddressList(msg.to),
      cc_addresses: this.asAddressList(msg.cc),
      date,
      preview,
      html_body: body?.html || null,
      text_body: body?.text || null,
      is_read: isRead,
      is_starred: isStarred,
      flags,
      attachments_meta: this.asAttachmentMeta(msg.attachments),
      in_reply_to: msg.inReplyTo || null,
      references_header: null,
      synced_at: new Date(),
      updated_at: new Date(),
    };
  }

  private toCachedEmail(accountId: string, folderPath: string, msg: HostingerMessage, body?: HostingerMessageText): any {
    const data = this.baseCacheData(accountId, folderPath, msg, body);
    return { id: randomUUID(), ...data, date: data.date.toISOString() };
  }

  private async upsertCachedMessage(baseData: any) {
    const existing = await this.prisma.cached_emails.findFirst({
      where: { account_id: baseData.account_id, folder_path: baseData.folder_path, uid: baseData.uid },
    });
    if (existing) {
      return this.prisma.cached_emails.update({ where: { id: existing.id }, data: { ...baseData, updated_at: new Date() } });
    }
    return this.prisma.cached_emails.create({ data: { ...baseData, created_at: new Date(), updated_at: new Date() } });
  }

  getPresets() {
    return buildDataEnvelope(EMAIL_PRESETS);
  }

  async discoverHostingerMailboxes(_user: Profile, dto: Record<string, unknown>) {
    const apiToken = stringValue(dto.api_token);
    if (!apiToken) throw new BadRequestException({ success: false, message: 'api_token is required' });
    try {
      const me = await this.hostinger.getCurrentAccount(apiToken);
      return buildDataEnvelope(me.data?.mailboxes || []);
    } catch (e: any) {
      throw new BadRequestException({ success: false, message: `Failed to validate Hostinger API token: ${e.message}` });
    }
  }

  async listAccounts(user: Profile) {
    return this.cached(this.cacheKey('accounts', user.id), async () => {
      const accounts = await this.prisma.email_accounts.findMany({ where: this.accountWhere(user), orderBy: { created_at: 'asc' } });
      return buildDataEnvelope(accounts.map((a) => this.sanitizeAccount(a)));
    });
  }

  async createAccount(user: Profile, dto: Record<string, unknown>) {
    const email = stringValue(dto.email);
    if (!email) throw new BadRequestException({ success: false, message: 'email is required' });

    const provider = stringValue(dto.provider) || (stringValue(dto.preset) === 'hostinger_rest' ? 'hostinger_rest' : 'imap');

    if (provider === 'hostinger_rest') {
      const apiToken = stringValue(dto.api_token);
      if (!apiToken) throw new BadRequestException({ success: false, message: 'api_token is required' });

      let resourceId = stringValue(dto.resource_id);
      let mailboxes: { resourceId: string; address: string }[] = [];
      try {
        const me = await this.hostinger.getCurrentAccount(apiToken);
        mailboxes = me.data?.mailboxes || [];
      } catch (e: any) {
        throw new BadRequestException({ success: false, message: `Failed to validate Hostinger API token: ${e.message}` });
      }

      if (!resourceId) {
        const match = mailboxes.find((m) => m.address?.toLowerCase() === email.toLowerCase());
        if (!match) {
          throw new BadRequestException({ success: false, message: `Mailbox for ${email} not found. Available: ${mailboxes.map((m) => m.address).join(', ')}` });
        }
        resourceId = match.resourceId;
      } else {
        const exists = mailboxes.some((m) => m.resourceId === resourceId);
        if (!exists) throw new BadRequestException({ success: false, message: 'resource_id is not accessible with this token' });
      }

      const created = await this.prisma.email_accounts.create({
        data: {
          id: randomUUID(),
          profile_id: user.id,
          email,
          display_name: stringValue(dto.display_name) || email,
          provider: 'hostinger_rest',
          resource_id: resourceId,
          api_token_encrypted: this.imap.encryptPassword(apiToken),
          shared_with_users: (dto.shared_with_users || []) as any,
          shared_with_roles: (dto.shared_with_roles || []) as any,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      await this.invalidateCache();
      return buildDataEnvelope(this.sanitizeAccount(created));
    }

    const presetName = stringValue(dto.preset);
    const preset = presetName ? EMAIL_PRESETS[presetName] : {};
    const username = stringValue(dto.username);
    const password = stringValue(dto.password);
    if (!username || !password) throw new BadRequestException({ success: false, message: 'username and password are required' });

    const created = await this.prisma.email_accounts.create({
      data: {
        id: randomUUID(),
        profile_id: user.id,
        email,
        display_name: stringValue(dto.display_name) || email,
        provider: 'imap',
        imap_host: stringValue(dto.imap_host) || preset.imap_host,
        imap_port: numberValue(dto.imap_port, preset.imap_port || 993),
        imap_secure: dto.imap_secure !== undefined ? dto.imap_secure === true : (preset.imap_secure !== undefined ? preset.imap_secure : true),
        smtp_host: stringValue(dto.smtp_host) || preset.smtp_host,
        smtp_port: numberValue(dto.smtp_port, preset.smtp_port || 465),
        smtp_secure: dto.smtp_secure !== undefined ? dto.smtp_secure === true : (preset.smtp_secure !== undefined ? preset.smtp_secure : true),
        username,
        password_encrypted: this.imap.encryptPassword(password),
        shared_with_users: (dto.shared_with_users || []) as any,
        shared_with_roles: (dto.shared_with_roles || []) as any,
      },
    });

    await this.invalidateCache();
    return buildDataEnvelope(this.sanitizeAccount(created));
  }

  async updateAccount(user: Profile, id: string, dto: Record<string, unknown>) {
    await this.findOwnedAccount(user, id);

    const data: any = {
      email: dto.email !== undefined ? stringValue(dto.email) : undefined,
      display_name: dto.display_name !== undefined ? stringValue(dto.display_name) : undefined,
      provider: dto.provider !== undefined ? stringValue(dto.provider) : undefined,
      resource_id: dto.resource_id !== undefined ? stringValue(dto.resource_id) : undefined,
      imap_host: dto.imap_host !== undefined ? stringValue(dto.imap_host) : undefined,
      imap_port: dto.imap_port !== undefined ? numberValue(dto.imap_port) : undefined,
      imap_secure: dto.imap_secure !== undefined ? dto.imap_secure === true : undefined,
      smtp_host: dto.smtp_host !== undefined ? stringValue(dto.smtp_host) : undefined,
      smtp_port: dto.smtp_port !== undefined ? numberValue(dto.smtp_port) : undefined,
      smtp_secure: dto.smtp_secure !== undefined ? dto.smtp_secure === true : undefined,
      username: dto.username !== undefined ? stringValue(dto.username) : undefined,
      signature_html: dto.signature_html !== undefined ? stringValue(dto.signature_html) : undefined,
      signature_text: dto.signature_text !== undefined ? stringValue(dto.signature_text) : undefined,
      aliases: dto.aliases !== undefined ? (dto.aliases as any) : undefined,
      shared_with_users: dto.shared_with_users !== undefined ? (dto.shared_with_users as any) : undefined,
      shared_with_roles: dto.shared_with_roles !== undefined ? (dto.shared_with_roles as any) : undefined,
      updated_at: new Date(),
    };

    if (dto.password !== undefined) {
      data.password_encrypted = this.imap.encryptPassword(stringValue(dto.password) || '');
    }
    if (dto.api_token !== undefined) {
      data.api_token_encrypted = this.imap.encryptPassword(stringValue(dto.api_token) || '');
    }

    const updated = await this.prisma.email_accounts.update({ where: { id }, data });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('accounts', user.id));
    return buildDataEnvelope(this.sanitizeAccount(updated));
  }

  async deleteAccount(user: Profile, id: string) {
    await this.findOwnedAccount(user, id);
    await this.prisma.email_accounts.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('accounts', user.id));
    return buildMessageEnvelope('Account removed');
  }

  async testAccount(user: Profile, id: string) {
    const account = await this.findAccount(user, id);
    if (account.provider === 'hostinger_rest') {
      try {
        const token = this.getHostingerToken(account);
        const me = await this.hostinger.getCurrentAccount(token);
        const mailboxes = me.data?.mailboxes || [];
        const accessible = account.resource_id ? mailboxes.some((m) => m.resourceId === account.resource_id) : mailboxes.length > 0;
        if (!accessible) throw new Error('Resource ID not accessible');
        return buildDataEnvelope({ success: true, provider: 'hostinger_rest' });
      } catch (e: any) {
        return buildDataEnvelope({ success: false, error: e.message });
      }
    }
    const result = await this.imap.testAccount(account);
    return buildDataEnvelope({ success: result.imap, ...result });
  }

  async listFolders(user: Profile, accountId: string) {
    return this.cached(this.cacheKey('folders', user.id, accountId), async () => {
      const account = await this.findAccount(user, accountId);

      if (account.provider === 'hostinger_rest') {
        const token = this.getHostingerToken(account);
        const resourceId = account.resource_id!;
        const result = await this.hostinger.listFolders(token, resourceId, 1, 100);
        const folders = (result.data || []).map((f: HostingerFolder) => ({ path: f.path, name: f.name }));
        if (!folders.find((f) => f.path?.toUpperCase() === 'INBOX')) {
          folders.unshift({ path: 'INBOX', name: 'INBOX' });
        }
        return buildDataEnvelope(folders);
      }

      const rows = await this.prisma.cached_emails.groupBy({ by: ['folder_path'], where: { account_id: accountId } });
      const folders = rows.map((r) => r.folder_path || 'INBOX');
      if (!folders.includes('INBOX')) folders.unshift('INBOX');
      return buildDataEnvelope(folders.map((f) => ({ path: f, name: f })));
    });
  }

  async listMessages(user: Profile, accountId: string, folderPath: string, query: Record<string, unknown>) {
    const account = await this.findAccount(user, accountId);
    const limit = numberValue(query.limit, 50);
    const offset = numberValue(query.offset, 0);

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      const resourceId = account.resource_id!;
      const page = Math.floor(offset / limit) + 1;
      const result = await this.hostinger.listMessages(token, resourceId, folderPath, page, limit, '-uid');
      const messages = (result.data || []).map((m: HostingerMessage) => this.toCachedEmail(accountId, folderPath, m));
      const total = result.pagination?.total || messages.length;
      return buildListEnvelope(messages, total, limit, offset);
    }

    return this.cached(this.cacheKey('messages', user.id, accountId, folderPath, JSON.stringify(query)), async () => {
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
      const account = await this.findAccount(user, accountId);
      const uidInt = parseInt(uid, 10);
      if (Number.isNaN(uidInt)) throw new BadRequestException({ success: false, message: 'Invalid uid' });

      if (account.provider === 'hostinger_rest') {
        const token = this.getHostingerToken(account);
        const resourceId = account.resource_id!;
        const [msgResult, textResult] = await Promise.all([
          this.hostinger.getMessage(token, resourceId, folderPath, uidInt),
          this.hostinger.getMessageText(token, resourceId, folderPath, uidInt),
        ]);
        const data = this.baseCacheData(accountId, folderPath, msgResult.data, textResult.data);
        const message = await this.upsertCachedMessage(data);
        return buildDataEnvelope(message);
      }

      let message = await this.prisma.cached_emails.findFirst({ where: { account_id: accountId, folder_path: folderPath, uid: uidInt } });

      if (!message || (!message.html_body && !message.text_body)) {
        const fetched = await this.imap.getMessage(account, folderPath, uidInt);
        const data: any = {
          message_id: fetched.message_id,
          subject: fetched.subject,
          from_address: fetched.from_address,
          from_name: fetched.from_name,
          to_addresses: fetched.to_addresses,
          cc_addresses: fetched.cc_addresses,
          date: fetched.date,
          preview: fetched.preview,
          html_body: fetched.html_body,
          text_body: fetched.text_body,
          is_read: fetched.is_read,
          is_starred: fetched.is_starred,
          flags: fetched.flags,
          attachments_meta: fetched.attachments_meta,
          in_reply_to: fetched.in_reply_to,
          references_header: fetched.references_header,
          synced_at: new Date(),
          updated_at: new Date(),
        };
        if (message) {
          message = await this.prisma.cached_emails.update({ where: { id: message.id }, data });
        } else {
          data.account_id = accountId;
          data.folder_path = folderPath;
          data.uid = uidInt;
          data.created_at = new Date();
          message = await this.prisma.cached_emails.create({ data });
        }
      }

      return buildDataEnvelope(message);
    });
  }

  async send(user: Profile, accountId: string, dto: Record<string, unknown>) {
    const account = await this.findAccount(user, accountId);
    const toEmail = stringValue(dto.to_email);
    const subject = stringValue(dto.subject);
    if (!toEmail || !subject) throw new BadRequestException({ success: false, message: 'to_email and subject are required' });

    const fromName = account.display_name || account.email;
    const textBody = stringValue(dto.body_text) || '';
    const htmlBody = stringValue(dto.body_html) || `<p>${textBody.replace(/\n/g, '<br>')}</p>`;

    let status: 'pending' | 'sent' | 'failed' | 'bounced' | 'opened' = 'pending';
    let messageId: string | undefined;
    let error: string | undefined;

    if (account.provider === 'hostinger_rest') {
      try {
        const token = this.getHostingerToken(account);
        const resourceId = account.resource_id!;
        const payload: HostingerSendRequest = {
          to: [toEmail],
          displayName: fromName,
          subject,
          text: textBody,
          html: htmlBody,
        };
        if (dto.cc_emails) {
          payload.cc = this.asStringArray(dto.cc_emails);
        }
        if (dto.bcc_emails) {
          payload.bcc = this.asStringArray(dto.bcc_emails);
        }
        if (dto.in_reply_to && typeof dto.in_reply_to === 'string') {
          const parts = dto.in_reply_to.split(':');
          if (parts.length >= 2) payload.inReplyTo = { uid: Number(parts[0]), folder: parts.slice(1).join(':') };
        }
        await this.hostinger.sendEmail(token, resourceId, payload);
        status = 'sent';
        messageId = `hostinger:${Date.now()}`;
      } catch (e: any) {
        status = 'failed';
        error = e.message || 'Failed to send email';
      }
    } else if (account.smtp_host) {
      try {
        const transporter = nodemailer.createTransport({
          host: account.smtp_host,
          port: Number(account.smtp_port) || 587,
          secure: account.smtp_secure ?? false,
          auth: {
            user: account.username || '',
            pass: this.imap.decryptPassword(account.password_encrypted || ''),
          },
          tls: { rejectUnauthorized: false },
        } as any);

        const result = await transporter.sendMail({
          from: `${fromName} <${account.email}>`,
          to: `${stringValue(dto.to_name) || toEmail} <${toEmail}>`,
          subject,
          text: textBody,
          html: htmlBody,
          inReplyTo: stringValue(dto.in_reply_to) || undefined,
          references: stringValue(dto.references) || undefined,
        });

        status = 'sent';
        messageId = result.messageId;
      } catch (e: any) {
        status = 'failed';
        error = e.message || 'Failed to send email';
      }
    } else {
      error = 'SMTP host is not configured for this account';
    }

    const log = await this.prisma.email_logs.create({
      data: {
        to_email: toEmail,
        to_name: stringValue(dto.to_name) || null,
        from_email: account.email,
        subject,
        status,
        triggered_by: user.id,
        metadata: { body_text: textBody, body_html: htmlBody, template: stringValue(dto.template), message_id: messageId, error } as any,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    if (status === 'failed') {
      throw new BadRequestException({ success: false, message: error || 'Failed to send email', data: { email: log } });
    }

    return buildMessageEnvelope(messageId ? 'Email sent' : 'Email queued for sending', { email: log });
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
      const account = await this.findAccount(user, id);
      return buildDataEnvelope({ signature_html: account.signature_html, signature_text: account.signature_text });
    });
  }

  async updateSignature(user: Profile, id: string, dto: Record<string, unknown>) {
    await this.findOwnedAccount(user, id);
    const updated = await this.prisma.email_accounts.update({
      where: { id },
      data: { signature_html: stringValue(dto.signature_html) || null, signature_text: stringValue(dto.signature_text) || null, updated_at: new Date() },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('signature', user.id, id));
    return buildDataEnvelope({ signature_html: updated.signature_html, signature_text: updated.signature_text });
  }

  async getAliases(user: Profile, id: string) {
    return this.cached(this.cacheKey('aliases', user.id, id), async () => {
      const account = await this.findAccount(user, id);
      return buildDataEnvelope(account.aliases || []);
    });
  }

  async updateAliases(user: Profile, id: string, dto: Record<string, unknown>) {
    await this.findOwnedAccount(user, id);
    const updated = await this.prisma.email_accounts.update({
      where: { id },
      data: { aliases: (dto.aliases || []) as any, updated_at: new Date() },
    });

    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('aliases', user.id, id));
    return buildDataEnvelope(updated.aliases || []);
  }

  // -------------------------------------------------------------------------
  // Folders
  // -------------------------------------------------------------------------

  async createFolder(user: Profile, accountId: string, folderPath: string) {
    const account = await this.findAccount(user, accountId);
    if (!folderPath) throw new BadRequestException({ success: false, message: 'folderPath is required' });
    const name = folderPath.toUpperCase().startsWith('INBOX/') ? folderPath : folderPath.replace(/^\//, '');

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      const result = await this.hostinger.createFolder(token, account.resource_id!, name);
      return buildDataEnvelope({ path: result.data?.folder?.path || name, name: result.data?.folder?.name || name });
    }

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
    const account = await this.findAccount(user, accountId);
    const newName = stringValue(dto.name)?.replace(/^\//, '');
    if (!newName) throw new BadRequestException({ success: false, message: 'name is required' });
    if (folderPath.toUpperCase() === 'INBOX') throw new BadRequestException({ success: false, message: 'Cannot rename INBOX' });

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      await this.hostinger.updateFolder(token, account.resource_id!, folderPath, newName);
      const list = await this.hostinger.listFolders(token, account.resource_id!, 1, 100);
      const renamed = list.data?.find((f) => f.name?.toLowerCase() === newName.toLowerCase());
      await this.prisma.cached_emails.updateMany({ where: { account_id: accountId, folder_path: folderPath }, data: { folder_path: renamed?.path || newName, updated_at: new Date() } });
      await this.invalidateCache();
      return buildMessageEnvelope('Folder renamed');
    }

    await this.prisma.cached_emails.updateMany({
      where: { account_id: accountId, folder_path: folderPath },
      data: { folder_path: newName, updated_at: new Date() },
    });
    await this.invalidateCache();
    return buildMessageEnvelope('Folder renamed');
  }

  async deleteFolder(user: Profile, accountId: string, folderPath: string) {
    const account = await this.findAccount(user, accountId);
    if (folderPath.toUpperCase() === 'INBOX' || folderPath.toUpperCase() === 'DRAFTS') {
      throw new BadRequestException({ success: false, message: 'Cannot delete protected folder' });
    }

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      await this.hostinger.deleteFolder(token, account.resource_id!, folderPath);
    }

    await this.prisma.cached_emails.deleteMany({ where: { account_id: accountId, folder_path: folderPath } });
    await this.invalidateCache();
    return buildMessageEnvelope('Folder deleted');
  }

  async syncFolder(user: Profile, accountId: string, folderPath: string) {
    const account = await this.findAccount(user, accountId);

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      const resourceId = account.resource_id!;
      const result = await this.hostinger.listMessages(token, resourceId, folderPath, 1, 100, '-uid');
      for (const msg of result.data || []) {
        await this.upsertCachedMessage(this.baseCacheData(accountId, folderPath, msg));
      }
      await this.invalidateCache();
      return buildMessageEnvelope(`Folder ${folderPath} synced`, { count: result.data?.length || 0 });
    }

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
    const account = await this.findAccount(user, accountId);
    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      await this.hostinger.deleteMessage(token, account.resource_id!, folderPath, message.uid);
    }
    await this.prisma.cached_emails.delete({ where: { id: message.id } });
    await this.invalidateCache();
    return buildMessageEnvelope('Message deleted');
  }

  async bulkDeleteMessages(user: Profile, accountId: string, folderPath: string, dto: Record<string, unknown>) {
    const account = await this.findAccount(user, accountId);
    const uids = Array.isArray(dto.uids) ? (dto.uids as number[]) : [];
    if (!uids.length) throw new BadRequestException({ success: false, message: 'uids are required' });

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      await this.hostinger.deleteMessages(token, account.resource_id!, folderPath, uids);
    }

    await this.prisma.cached_emails.deleteMany({ where: { account_id: accountId, folder_path: folderPath, uid: { in: uids } } });
    await this.invalidateCache();
    return buildMessageEnvelope('Messages deleted');
  }

  async bulkReadMessages(user: Profile, accountId: string, folderPath: string, dto: Record<string, unknown>) {
    const account = await this.findAccount(user, accountId);
    const uids = Array.isArray(dto.uids) ? (dto.uids as number[]) : [];
    const isRead = dto.is_read === true || dto.is_read === 'true' ? true : false;

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      await this.hostinger.updateMessageFlags(token, account.resource_id!, folderPath, uids, isRead ? ['\\Seen'] : undefined, isRead ? undefined : ['\\Seen']);
    }

    await this.prisma.cached_emails.updateMany({
      where: { account_id: accountId, folder_path: folderPath, uid: { in: uids } },
      data: { is_read: isRead, updated_at: new Date() },
    });
    await this.invalidateCache();
    return buildMessageEnvelope('Messages updated');
  }

  async moveMessage(user: Profile, accountId: string, folderPath: string, uid: string, dto: Record<string, unknown>) {
    const account = await this.findAccount(user, accountId);
    const message = await this.findMessage(user, accountId, folderPath, uid);
    const target = stringValue(dto.folder);
    if (!target) throw new BadRequestException({ success: false, message: 'folder is required' });

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      await this.hostinger.moveMessage(token, account.resource_id!, folderPath, message.uid, target);
      // Try to locate the moved message in the target folder by message_id to update uid.
      if (message.message_id) {
        try {
          const list = await this.hostinger.listMessages(token, account.resource_id!, target, 1, 50, '-uid');
          const moved = list.data?.find((m) => m.messageId === message.message_id);
          if (moved) {
            const data = this.baseCacheData(accountId, target, moved);
            await this.upsertCachedMessage(data);
          }
        } catch {
          // ignore lookup failure
        }
      }
      await this.prisma.cached_emails.delete({ where: { id: message.id } });
      await this.invalidateCache();
      return buildMessageEnvelope('Message moved');
    }

    const newUid = await this.nextUid(accountId, target);
    await this.prisma.cached_emails.update({
      where: { id: message.id },
      data: { folder_path: target, uid: newUid, updated_at: new Date() },
    });
    await this.invalidateCache();
    return buildDataEnvelope({ ...message, folder_path: target, uid: newUid });
  }

  async starMessage(user: Profile, accountId: string, folderPath: string, uid: string, dto: Record<string, unknown>) {
    const account = await this.findAccount(user, accountId);
    const starred = dto.starred === true || dto.starred === 'true' ? true : false;

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      const result = await this.hostinger.patchMessage(token, account.resource_id!, folderPath, Number(uid), starred ? ['\\Flagged'] : undefined, starred ? undefined : ['\\Flagged']);
      const data = this.baseCacheData(accountId, folderPath, result.data);
      await this.upsertCachedMessage(data);
      return buildDataEnvelope(data);
    }

    const message = await this.findMessage(user, accountId, folderPath, uid);
    await this.prisma.cached_emails.update({ where: { id: message.id }, data: { is_starred: starred, updated_at: new Date() } });
    await this.invalidateCache();
    return buildDataEnvelope({ ...message, is_starred: starred });
  }

  async markRead(user: Profile, accountId: string, folderPath: string, uid: string, dto: Record<string, unknown>) {
    const account = await this.findAccount(user, accountId);
    const isRead = dto.is_read === true || dto.is_read === 'true' ? true : false;

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      const result = await this.hostinger.patchMessage(token, account.resource_id!, folderPath, Number(uid), isRead ? ['\\Seen'] : undefined, isRead ? undefined : ['\\Seen']);
      const data = this.baseCacheData(accountId, folderPath, result.data);
      await this.upsertCachedMessage(data);
      return buildDataEnvelope(data);
    }

    const message = await this.findMessage(user, accountId, folderPath, uid);
    await this.prisma.cached_emails.update({ where: { id: message.id }, data: { is_read: isRead, updated_at: new Date() } });
    await this.invalidateCache();
    return buildDataEnvelope({ ...message, is_read: isRead });
  }

  async searchMessages(user: Profile, accountId: string, folderPath: string, query: Record<string, unknown>) {
    const account = await this.findAccount(user, accountId);
    const term = stringValue(query.q)?.toLowerCase();
    const limit = numberValue(query.limit, 50);
    const offset = numberValue(query.offset, 0);

    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      const page = Math.floor(offset / limit) + 1;
      const filters: any = {};
      if (term) {
        filters.subject = term;
        filters.from = term;
        filters.text = term;
      }
      const result = await this.hostinger.searchMessages(token, account.resource_id!, folderPath, filters, page, limit, '-uid');
      const messages = (result.data || []).map((m: HostingerMessage) => this.toCachedEmail(accountId, folderPath, m));
      const total = result.pagination?.total || messages.length;
      return buildListEnvelope(messages, total, limit, offset);
    }

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
    const account = await this.findAccount(user, accountId);
    if (account.provider === 'hostinger_rest') {
      const token = this.getHostingerToken(account);
      const msg = await this.hostinger.getMessage(token, account.resource_id!, folderPath, Number(uid));
      const attachments = msg.data?.attachments || [];
      const attachment = attachments.find((a: any) => a.id === attachmentId || a.filename === attachmentId);
      if (!attachment) throw new NotFoundException({ success: false, message: 'Attachment not found' });
      return buildDataEnvelope(attachment);
    }

    const message = await this.findMessage(user, accountId, folderPath, uid);
    const attachments = (message.attachments_meta as any[]) || [];
    const attachment = attachments.find((a: any) => a.id === attachmentId || a.filename === attachmentId);
    if (!attachment) throw new NotFoundException({ success: false, message: 'Attachment not found' });
    return buildDataEnvelope(attachment);
  }

  async createDraft(user: Profile, accountId: string, dto: Record<string, unknown>) {
    const account = await this.findAccount(user, accountId);
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

  private async findMessage(user: Profile, accountId: string, folderPath: string, uid: string) {
    await this.findAccount(user, accountId);
    const uidInt = parseInt(uid, 10);
    if (Number.isNaN(uidInt)) throw new BadRequestException({ success: false, message: 'Invalid uid' });
    const message = await this.prisma.cached_emails.findFirst({ where: { account_id: accountId, folder_path: folderPath, uid: uidInt } });
    if (!message) throw new NotFoundException({ success: false, message: 'Message not found' });
    return message;
  }
}
