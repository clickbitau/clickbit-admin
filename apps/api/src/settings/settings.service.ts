import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { stringValue, numberValue, parseSettingJson, buildMessageEnvelope } from './settings-utils';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicBillingSettings() {
    const stripe = await this.getSettingRaw('stripe_settings') || {};
    const tax = await this.getSettingRaw('tax_settings') || {};
    const gmaps = await this.getSettingRaw('google_maps_api_key') || {};
    return {
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || stripe?.publishable_key || '',
      enableStripe: stripe?.enabled !== false,
      currencyCode: tax?.currency || 'AUD',
      taxRate: numberValue(tax?.tax_rate, 10),
      taxType: tax?.tax_type || 'gst_included',
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || gmaps?.api_key || '',
    };
  }

  async getPublicSettings() {
    const rows = await this.prisma.site_settings.findMany({ where: { is_public: true, auto_load: true }, select: { setting_key: true, setting_value: true } });
    const obj: Record<string, any> = {};
    for (const row of rows) obj[row.setting_key] = row.setting_value;
    return obj;
  }

  async getPublicSetting(key: string) {
    const row = await this.prisma.site_settings.findFirst({ where: { setting_key: key, is_public: true }, select: { setting_key: true, setting_value: true, setting_type: true } });
    if (!row) throw new NotFoundException({ message: 'Setting not found or not public' });
    return { [row.setting_key]: row.setting_value };
  }

  async findAllAdmin(query: Record<string, unknown>) {
    const where: any = {};
    const type = stringValue(query.type);
    const search = stringValue(query.search);
    if (type && type !== 'all') where.setting_type = type;
    if (search) where.OR = [{ setting_key: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }];
    return this.prisma.site_settings.findMany({ where, orderBy: [{ setting_type: 'asc' }, { setting_key: 'asc' }] });
  }

  async findByType(type: string) {
    const rows = await this.prisma.site_settings.findMany({ where: { setting_type: type }, orderBy: { setting_key: 'asc' } });
    const obj: Record<string, any> = {};
    for (const row of rows) {
      obj[row.setting_key] = { value: row.setting_value, description: row.description, is_public: row.is_public, auto_load: row.auto_load };
    }
    return obj;
  }

  async findByKey(key: string) {
    const row = await this.prisma.site_settings.findFirst({ where: { setting_key: key } });
    if (!row) throw new NotFoundException({ message: 'Setting not found' });
    return row;
  }

  async upsert(key: string, body: any) {
    const setting_value = body.setting_value !== undefined ? stringValue(body.setting_value) : undefined;
    const setting_type = body.setting_type !== undefined ? stringValue(body.setting_type) : 'system';
    const description = body.description !== undefined ? stringValue(body.description) : undefined;
    const is_public = body.is_public !== undefined ? (body.is_public === true) : undefined;
    const auto_load = body.auto_load !== undefined ? (body.auto_load === true) : undefined;
    const existing = await this.prisma.site_settings.findFirst({ where: { setting_key: key } });
    if (existing) {
      const data: any = {};
      if (setting_value !== undefined) data.setting_value = setting_value;
      if (body.setting_type !== undefined) data.setting_type = setting_type;
      if (description !== undefined) data.description = description;
      if (is_public !== undefined) data.is_public = is_public;
      if (auto_load !== undefined) data.auto_load = auto_load;
      data.updated_at = new Date();
      const updated = await this.prisma.site_settings.update({ where: { id: existing.id }, data });
      return { message: 'Setting updated successfully', setting: updated };
    }
    const created = await this.prisma.site_settings.create({
      data: { setting_key: key, setting_value, setting_type, description, is_public: is_public || false, auto_load: auto_load || false, created_at: new Date(), updated_at: new Date() },
    });
    return { message: 'Setting created successfully', setting: created };
  }

  async bulkUpdate(body: any) {
    const settings = body.settings;
    if (!settings || typeof settings !== 'object') return { message: 'Settings object is required' };
    const results: any[] = [];
    for (const [key, data] of Object.entries(settings)) {
      const value = typeof data === 'object' && data !== null ? (data as any).value || data : data;
      const res = await this.upsert(key, { setting_value: value, ...(typeof data === 'object' && data !== null ? data : {}) });
      results.push({ key, ...res });
    }
    return { message: 'Settings updated successfully', results };
  }

  async remove(key: string) {
    const existing = await this.prisma.site_settings.findFirst({ where: { setting_key: key } });
    if (!existing) throw new NotFoundException({ message: 'Setting not found' });
    await this.prisma.site_settings.delete({ where: { id: existing.id } });
    return buildMessageEnvelope('Setting deleted successfully');
  }

  async getMarketingIntegrations() {
    const row = await this.getSettingRaw('marketing_integrations');
    if (row && typeof row === 'object') return row;
    return { headerScripts: '', googleSearchConsoleTag: '', googleAnalyticsId: '', facebookPixelId: '', customMetaTags: '' };
  }

  async updateMarketingIntegrations(body: any) {
    const value = body.marketingIntegrations !== undefined ? body.marketingIntegrations : body;
    return this.upsert('marketing_integrations', { setting_value: JSON.stringify(value), setting_type: 'marketing', description: 'Marketing and analytics integration settings', is_public: false, auto_load: false });
  }

  async getBillingSettings() {
    const row = await this.getSettingRaw('billing_settings');
    if (row && typeof row === 'object') return row;
    return { stripePublishableKey: '', stripeSecretKey: '', currencyCode: 'AUD', taxRate: 10, companyAbn: '', billingAddress: '', paymentTerms: 'Net 30' };
  }

  async updateBillingSettings(body: any) {
    const value = body.billingSettings !== undefined ? body.billingSettings : body;
    return this.upsert('billing_settings', { setting_value: JSON.stringify(value), setting_type: 'billing', description: 'Payment and billing configuration settings', is_public: false, auto_load: false });
  }

  private async getSettingRaw(key: string): Promise<any> {
    const row = await this.prisma.site_settings.findFirst({ where: { setting_key: key }, select: { setting_value: true } });
    if (!row || !row.setting_value) return null;
    return parseSettingJson(row.setting_value, null);
  }
}
