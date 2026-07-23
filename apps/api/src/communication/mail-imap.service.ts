import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { PrismaService } from '../prisma/prisma.service';

interface ParsedMessage {
  uid: number;
  flags: string[];
  date: Date;
  subject: string;
  from_name: string | null;
  from_address: string | null;
  to_addresses: { name?: string; email?: string }[];
  cc_addresses: { name?: string; email?: string }[];
  message_id: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  preview: string;
  html_body: string | null;
  text_body: string | null;
  attachments_meta: { filename?: string; contentType?: string; size?: number }[];
  is_read: boolean;
  is_starred: boolean;
}

@Injectable()
export class MailImapService {
  private readonly logger = new Logger(MailImapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): string | undefined {
    return this.config.get<string>('EMAIL_ENCRYPTION_KEY') ?? process.env.EMAIL_ENCRYPTION_KEY;
  }

  private isEncrypted(value: string): boolean {
    const parts = value.split(':');
    if (parts.length !== 3) return false;
    return parts.every((p) => /^[0-9a-fA-F]+$/.test(p));
  }

  decryptPassword(value: string): string {
    if (!this.isEncrypted(value)) return value;
    const key = this.encryptionKey;
    if (!key) return value;
    try {
      const [ivHex, tagHex, encrypted] = value.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e: any) {
      this.logger.warn(`Failed to decrypt email password: ${e.message}`);
      return value;
    }
  }

  encryptPassword(value: string): string {
    const key = this.encryptionKey;
    if (!key) return value;
    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();
      return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
    } catch (e: any) {
      this.logger.warn(`Failed to encrypt email password: ${e.message}`);
      return value;
    }
  }

  private getPassword(account: any): string {
    return account.password_encrypted ? this.decryptPassword(account.password_encrypted) : '';
  }

  private getClient(account: any) {
    return new ImapFlow({
      host: account.imap_host,
      port: account.imap_port ?? 993,
      secure: account.imap_secure ?? true,
      auth: {
        user: account.username,
        pass: this.getPassword(account),
      },
      logger: false,
      emitLogs: false,
    });
  }

  private normalizeAddresses(value: any): { name?: string; email?: string }[] {
    if (!value) return [];
    const obj = Array.isArray(value) ? value[0] : value;
    const list = obj?.value || [];
    return list
      .map((a: any) => ({
        name: a.name || undefined,
        email: a.address || undefined,
      }))
      .filter((a: any) => a.email);
  }

  private async parseMessage(msg: any): Promise<ParsedMessage> {
    const parsed = await simpleParser(msg.source);
    const fromObj = Array.isArray(parsed.from) ? parsed.from[0] : parsed.from;
    const from = fromObj?.value || [];
    const firstFrom = from[0];

    const flags: string[] = Array.isArray(msg.flags)
      ? msg.flags
      : msg.flags
        ? Array.from(msg.flags)
        : [];

    return {
      uid: msg.uid,
      flags,
      date: parsed.date ?? new Date(),
      subject: parsed.subject || '(No Subject)',
      from_name: firstFrom?.name || null,
      from_address: firstFrom?.address || null,
      to_addresses: this.normalizeAddresses(parsed.to),
      cc_addresses: this.normalizeAddresses(parsed.cc),
      message_id: parsed.messageId || null,
      in_reply_to: parsed.inReplyTo || null,
      references_header: Array.isArray(parsed.references) ? parsed.references.join(' ') : parsed.references || null,
      preview: (parsed.text || '').substring(0, 200),
      html_body: parsed.html || null,
      text_body: parsed.text || null,
      attachments_meta: (parsed.attachments || []).map((att: any) => ({
        filename: att.filename || 'unnamed',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
      })),
      is_read: flags.includes('\\Seen'),
      is_starred: flags.includes('\\Flagged'),
    };
  }

  async testAccount(account: any): Promise<{ imap: boolean; smtp: boolean; errors: string[] }> {
    const errors: string[] = [];
    let imap = false;
    const client = this.getClient(account);
    try {
      await client.connect();
      await client.mailboxOpen('INBOX');
      imap = true;
    } catch (e: any) {
      errors.push(`IMAP error: ${e.message}`);
    } finally {
      await client.logout().catch(() => {});
    }
    return { imap, smtp: false, errors };
  }

  async getFolders(account: any): Promise<{ path: string; name: string; flags: string[] }[]> {
    const client = this.getClient(account);
    try {
      await client.connect();
      const mailboxes = await client.list();
      return mailboxes.map((m) => ({ path: m.path, name: m.name, flags: Array.from(m.flags || []) }));
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async getMessage(account: any, folderPath: string, uid: number): Promise<ParsedMessage> {
    const client = this.getClient(account);
    try {
      await client.connect();
      await client.mailboxOpen(folderPath);
      const msg = await client.fetchOne(uid.toString(), { source: true, flags: true }, { uid: true });
      if (!msg) throw new Error('Message not found');
      return this.parseMessage(msg);
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async syncAccount(account: any): Promise<void> {
    const client = this.getClient(account);
    try {
      await client.connect();
      const mailboxes = await client.list();
      for (const folder of mailboxes) {
        try {
          const mailbox = await client.mailboxOpen(folder.path);
          const exists = mailbox.exists ?? 0;
          if (!exists) continue;
          const start = Math.max(1, exists - 49);
          const messages = client.fetch(`${start}:*`, { source: true, flags: true, uid: true });
          for await (const msg of messages) {
            try {
              const parsed = await this.parseMessage(msg);
              const existing = await this.prisma.cached_emails.findFirst({
                where: { account_id: account.id, folder_path: folder.path, uid: parsed.uid },
              });
              const data: any = {
                account_id: account.id,
                folder_path: folder.path,
                uid: parsed.uid,
                message_id: parsed.message_id,
                subject: parsed.subject,
                from_address: parsed.from_address,
                from_name: parsed.from_name,
                to_addresses: parsed.to_addresses,
                cc_addresses: parsed.cc_addresses,
                date: parsed.date,
                preview: parsed.preview,
                html_body: parsed.html_body,
                text_body: parsed.text_body,
                is_read: parsed.is_read,
                is_starred: parsed.is_starred,
                flags: parsed.flags,
                attachments_meta: parsed.attachments_meta,
                in_reply_to: parsed.in_reply_to,
                references_header: parsed.references_header,
                synced_at: new Date(),
                updated_at: new Date(),
              };
              if (existing) {
                await this.prisma.cached_emails.update({ where: { id: existing.id }, data });
              } else {
                data.created_at = new Date();
                await this.prisma.cached_emails.create({ data });
              }
            } catch (parseErr: any) {
              this.logger.warn(`Failed to parse message ${folder.path}/${msg.uid}: ${parseErr.message}`);
            }
          }
        } catch (folderErr: any) {
          this.logger.warn(`Failed to sync folder ${folder.path}: ${folderErr.message}`);
        }
      }
      await this.prisma.email_accounts.update({
        where: { id: account.id },
        data: { last_sync_at: new Date(), last_error: null },
      });
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async syncAllActiveAccounts(): Promise<void> {
    const accounts = await this.prisma.email_accounts.findMany({ where: { is_active: true } });
    for (const account of accounts) {
      try {
        await this.syncAccount(account);
      } catch (e: any) {
        this.logger.error(`Mail sync failed for ${account.email}: ${e.message}`);
        await this.prisma.email_accounts.update({
          where: { id: account.id },
          data: { last_error: e.message },
        }).catch(() => {});
      }
    }
  }
}
