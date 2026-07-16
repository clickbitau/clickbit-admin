import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function maskValue(val?: string | null) {
  if (!val) return '';
  if (val.length <= 8) return '••••••••';
  return val.slice(0, 4) + '••••••••' + val.slice(-4);
}

const CATEGORY_META: Record<string, { label: string; description?: string }> = {
  email: { label: 'Email', description: 'SMTP and email service credentials' },
  stripe: { label: 'Stripe', description: 'Stripe payment settings' },
  supabase: { label: 'Supabase', description: 'Supabase project settings' },
  storage: { label: 'Storage', description: 'Object storage settings' },
  app: { label: 'App', description: 'General application settings' },
  integrations: { label: 'Integrations', description: 'Third-party integrations' },
};

const DEFINITIONS: { key: string; category: string; label: string; description?: string; is_secret: boolean }[] = [
  { key: 'SMTP_HOST', category: 'email', label: 'SMTP Host', is_secret: false },
  { key: 'SMTP_PORT', category: 'email', label: 'SMTP Port', is_secret: false },
  { key: 'SMTP_USER', category: 'email', label: 'SMTP User', is_secret: false },
  { key: 'SMTP_PASS', category: 'email', label: 'SMTP Password', is_secret: true },
  { key: 'SMTP_SECURE', category: 'email', label: 'SMTP Secure', is_secret: false },
  { key: 'STRIPE_SECRET_KEY', category: 'stripe', label: 'Stripe Secret Key', is_secret: true },
  { key: 'STRIPE_PUBLISHABLE_KEY', category: 'stripe', label: 'Stripe Publishable Key', is_secret: false },
  { key: 'STRIPE_WEBHOOK_SECRET', category: 'stripe', label: 'Stripe Webhook Secret', is_secret: true },
  { key: 'SUPABASE_URL', category: 'supabase', label: 'Supabase URL', is_secret: false },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', category: 'supabase', label: 'Supabase Service Role Key', is_secret: true },
  { key: 'FRONTEND_URL', category: 'app', label: 'Frontend URL', is_secret: false },
  { key: 'ENCRYPTION_KEY', category: 'app', label: 'Encryption Key', is_secret: true },
];

@Injectable()
export class CredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(row: any, _mask = true) {
    return {
      id: row.id,
      key: row.key,
      value: row.is_secret ? maskValue(row.value) : (row.value || ''),
      is_secret: row.is_secret,
      label: row.label || row.key,
      description: row.description,
      category: row.category,
      sort_order: row.sort_order,
      has_value: !!row.value,
    };
  }

  async ensureDefinitions() {
    for (const def of DEFINITIONS) {
      const existing = await this.prisma.app_credentials.findUnique({ where: { key: def.key } });
      if (!existing) {
        await this.prisma.app_credentials.create({
          data: {
            key: def.key,
            category: def.category,
            label: def.label,
            description: def.description,
            is_secret: def.is_secret,
            value: null,
          } as any,
        });
      }
    }
  }

  async getAll() {
    await this.ensureDefinitions();
    const rows = await this.prisma.app_credentials.findMany({ orderBy: [{ category: 'asc' }, { sort_order: 'asc' }] });
    const grouped: any = {};
    for (const row of rows) {
      if (!grouped[row.category]) {
        grouped[row.category] = { ...(CATEGORY_META[row.category] || { label: row.category, description: '' }), credentials: [] };
      }
      grouped[row.category].credentials.push(this.serialize(row));
    }
    for (const [cat, meta] of Object.entries(CATEGORY_META)) {
      if (!grouped[cat]) grouped[cat] = { ...meta, credentials: [] };
    }
    return { categories: grouped };
  }

  async getByCategory(category: string) {
    await this.ensureDefinitions();
    const rows = await this.prisma.app_credentials.findMany({ where: { category }, orderBy: { sort_order: 'asc' } });
    const meta = CATEGORY_META[category] || {};
    return { ...meta, credentials: rows.map((r) => this.serialize(r)) };
  }

  getDefinitions() {
    return { definitions: DEFINITIONS, categories: CATEGORY_META };
  }

  async set(key: string, value: string) {
    if (value && value.includes('••••••••')) {
      throw new BadRequestException('Cannot save a masked value');
    }
    const row = await this.prisma.app_credentials.findUnique({ where: { key } });
    if (!row) throw new NotFoundException('Credential not found');
    const updated = await this.prisma.app_credentials.update({ where: { key }, data: { value } });
    return { message: 'Credential updated', key, credential: this.serialize(updated, false) };
  }

  async bulkSet(updates: { key: string; value: string }[]) {
    const realUpdates = updates.filter((u) => u.value && !u.value.includes('••••••••'));
    const keys: string[] = [];
    for (const u of realUpdates) {
      const existing = await this.prisma.app_credentials.findUnique({ where: { key: u.key } });
      if (existing) {
        await this.prisma.app_credentials.update({ where: { key: u.key }, data: { value: u.value } });
        keys.push(u.key);
      }
    }
    return { message: `Updated ${keys.length} credential(s)`, keys };
  }

  async seedFromEnv() {
    let count = 0;
    for (const def of DEFINITIONS) {
      const envValue = process.env[def.key];
      if (envValue) {
        const existing = await this.prisma.app_credentials.findUnique({ where: { key: def.key } });
        if (existing && !existing.value) {
          await this.prisma.app_credentials.update({ where: { key: def.key }, data: { value: envValue } });
          count++;
        }
      }
    }
    return { message: `Seeded ${count} credential(s) from environment`, count };
  }

  async testSmtp() {
    const get = async (key: string) => {
      const row = await this.prisma.app_credentials.findUnique({ where: { key } });
      return row?.value || '';
    };
    const host = await get('SMTP_HOST');
    const port = parseInt(await get('SMTP_PORT') || '465', 10);
    const secure = (await get('SMTP_SECURE')) === 'true';
    const user = await get('SMTP_USER');
    const pass = await get('SMTP_PASS');
    if (!host || !user || !pass) {
      return { success: false, message: 'SMTP credentials are not configured' };
    }
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      await transporter.verify();
      return { success: true, message: 'SMTP connection successful' };
    } catch (error: any) {
      return { success: false, message: `SMTP test failed: ${error.message}` };
    }
  }
}
