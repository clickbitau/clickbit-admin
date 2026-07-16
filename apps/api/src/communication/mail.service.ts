import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { buildDataEnvelope, buildListEnvelope, buildMessageEnvelope, numberValue, stringValue } from './communication-utils';

const EMAIL_PRESETS: Record<string, any> = {
  hostinger: { imap_host: 'imap.hostinger.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.hostinger.com', smtp_port: 465, smtp_secure: true },
  gmail: { imap_host: 'imap.gmail.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_secure: false },
  outlook: { imap_host: 'outlook.office365.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.office365.com', smtp_port: 587, smtp_secure: false },
  yahoo: { imap_host: 'imap.mail.yahoo.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.mail.yahoo.com', smtp_port: 465, smtp_secure: true },
};

@Injectable()
export class MailService {
  constructor(private readonly prisma: PrismaService) {}

  getPresets() {
    return buildDataEnvelope(EMAIL_PRESETS);
  }

  async listAccounts(user: Profile) {
    const accounts = await this.prisma.email_accounts.findMany({ where: { profile_id: user.id }, orderBy: { created_at: 'asc' } });
    return buildDataEnvelope(accounts);
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

    return buildDataEnvelope(updated);
  }

  async deleteAccount(user: Profile, id: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    await this.prisma.email_accounts.delete({ where: { id } });
    return buildMessageEnvelope('Account removed');
  }

  testAccount(_user: Profile, _id: string) {
    return Promise.resolve(buildMessageEnvelope('Connection test passed (stub)'));
  }

  async listFolders(user: Profile, accountId: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const rows = await this.prisma.cached_emails.groupBy({ by: ['folder_path'], where: { account_id: accountId } });
    const folders = rows.map((r) => r.folder_path || 'INBOX');
    if (!folders.includes('INBOX')) folders.unshift('INBOX');
    return buildDataEnvelope(folders.map((f) => ({ path: f, name: f })));
  }

  async listMessages(user: Profile, accountId: string, folderPath: string, query: Record<string, unknown>) {
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
  }

  async getMessage(user: Profile, accountId: string, folderPath: string, uid: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id: accountId, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const uidInt = parseInt(uid, 10);
    if (Number.isNaN(uidInt)) throw new BadRequestException({ success: false, message: 'Invalid uid' });
    const message = await this.prisma.cached_emails.findFirst({ where: { account_id: accountId, folder_path: folderPath, uid: uidInt } });
    if (!message) throw new NotFoundException({ success: false, message: 'Message not found' });
    return buildDataEnvelope(message);
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
    const templates = await this.prisma.email_templates.findMany({ where: { profile_id: user.id }, orderBy: { created_at: 'desc' } });
    return buildDataEnvelope(templates);
  }

  async createTemplate(user: Profile, dto: Record<string, unknown>) {
    const name = stringValue(dto.name);
    if (!name) throw new BadRequestException({ success: false, message: 'Template name is required' });

    const created = await this.prisma.email_templates.create({
      data: { id: randomUUID(), profile_id: user.id, name, subject: stringValue(dto.subject) || null, body_text: stringValue(dto.body_text) || null, body_html: stringValue(dto.body_html) || null },
    });

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

    return buildDataEnvelope(updated);
  }

  async deleteTemplate(user: Profile, id: string) {
    const template = await this.prisma.email_templates.findFirst({ where: { id, profile_id: user.id } });
    if (!template) throw new NotFoundException({ success: false, message: 'Template not found' });
    await this.prisma.email_templates.delete({ where: { id } });
    return buildMessageEnvelope('Template removed');
  }

  async getSignature(user: Profile, id: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id }, select: { signature_html: true, signature_text: true } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    return buildDataEnvelope({ signature_html: account.signature_html, signature_text: account.signature_text });
  }

  async updateSignature(user: Profile, id: string, dto: Record<string, unknown>) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const updated = await this.prisma.email_accounts.update({
      where: { id },
      data: { signature_html: stringValue(dto.signature_html) || null, signature_text: stringValue(dto.signature_text) || null },
    });

    return buildDataEnvelope({ signature_html: updated.signature_html, signature_text: updated.signature_text });
  }

  async getAliases(user: Profile, id: string) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id }, select: { aliases: true } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });
    return buildDataEnvelope(account.aliases || []);
  }

  async updateAliases(user: Profile, id: string, dto: Record<string, unknown>) {
    const account = await this.prisma.email_accounts.findFirst({ where: { id, profile_id: user.id } });
    if (!account) throw new NotFoundException({ success: false, message: 'Account not found' });

    const updated = await this.prisma.email_accounts.update({
      where: { id },
      data: { aliases: (dto.aliases || []) as any },
    });

    return buildDataEnvelope(updated.aliases || []);
  }
}
