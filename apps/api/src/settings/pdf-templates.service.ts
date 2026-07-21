import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_INVOICE_CSS,
  DEFAULT_INVOICE_HTML,
  DEFAULT_PAYSLIP_CSS,
  DEFAULT_PAYSLIP_HTML,
} from './default-pdf-templates';
import { CacheService } from '../redis/cache.service';

const KEY = 'pdf_templates';

const DEFAULT_HEADER = '';
const DEFAULT_FOOTER = '';

function normalizeTemplateData(data: any) {
  const type = data.template_type || data.type || 'invoice';
  return {
    name: data.name,
    description: data.description ?? '',
    template_type: type,
    html: data.html ?? '',
    css: data.css ?? '',
    header: data.header ?? data.header_html ?? '',
    footer: data.footer ?? data.footer_html ?? '',
    is_default: data.is_default,
  };
}

@Injectable()
export class PdfTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('pdf-templates', ...parts) ?? `pdf-templates:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  private async getTemplates() {
    const row = await this.prisma.site_settings.findFirst({ where: { setting_key: KEY } });
    if (!row?.setting_value) return [];
    try {
      return JSON.parse(row.setting_value) || [];
    } catch {
      return [];
    }
  }

  private async saveTemplates(templates: any[]) {
    const row = await this.prisma.site_settings.findFirst({ where: { setting_key: KEY } });
    if (row) {
      await this.prisma.site_settings.update({ where: { id: row.id }, data: { setting_value: JSON.stringify(templates) } });
    } else {
      await this.prisma.site_settings.create({
        data: { setting_key: KEY, setting_value: JSON.stringify(templates), setting_type: 'system', is_public: false } as any,
      });
    }
    await this.invalidateCache();
  }

  private getSampleData(): Record<string, any> {
    return {
      document_title: 'INVOICE',
      invoice_number: 'CLKINV-26-01-09-002',
      quote_number: 'QT-0001',
      date: '09/01/26',
      due_date: '31/01/26',
      client_name: 'Saiful',
      client_company: 'iGenius & Oracle Education',
      client_email: 'info@igeniusprofessionals.com.au',
      company_name: 'ClickBIT Pty Ltd',
      company_address: '19 Drysdale Approach, Baldivis WA 6171',
      company_phone: '02 7229 9577',
      company_email: 'info@clickbit.com.au',
      company_abn: '59 267 698 766',
      items: [
        { description: '<div class="item-name">Meta Ads Creation</div><div class="item-description">+ (9 Static Ads + 1 Video Reel)</div>', quantity: '3.5', unit_price: '$45', amount: '$157.50' },
      ],
      subtotal: '$147.91',
      tax: '$9.59',
      discount: '-$51.975',
      total: '$105.53',
      amount_due: '$105.53',
      notes: 'Cost Breakdown:\n1. 10 Nov 2025 - Creation of 9 static images - 2 hours\n2. 16 Dec 2025 - Changing of images - 0.5 hours\n3. 31 Dec 2025 - Video Slider Creation - 1 hour',
      payment_terms: 'Payment is due within 14 days of invoice date.',
      bank_account_name: 'Kauser Ahmed Methel',
      bank_bsb: '013-017',
      bank_account_number: '167658357',
      employee_name: 'John Smith',
      position: 'Senior Developer',
      employment_type: 'Full-Time',
      tfn: '***-***-123',
      pay_date: '16 Jan 2026',
      pay_frequency: 'Fortnightly',
      hourly_rate: '$45.00/hr',
      super_fund: 'Australian Super',
      hours_worked: '76.0',
      ordinary_hours_pay: '$3,420.00',
      annual_leave_hours: '0',
      personal_leave_hours: '0',
      overtime_hours: '0',
      annual_leave_amount: '$0.00',
      personal_leave_amount: '$0.00',
      overtime_amount: '$0.00',
      gross_pay: '$3,420.00',
      net_pay: '$2,736.00',
      tax_deduction: '$684.00',
      superannuation: '$393.30',
      other_deductions: '$0.00',
      total_deductions: '$1,077.30',
      ytd_gross: '$44,460.00',
      ytd_tax: '$8,892.00',
      ytd_super: '$5,112.90',
      ytd_net: '$35,568.00',
      annual_leave_balance: '76.0',
      sick_leave_balance: '38.0',
      long_service_leave_balance: '0.0',
      bank_name: 'Commonwealth Bank',
      pay_period: '01 Jan 2026 - 14 Jan 2026',
    };
  }

  private renderPreviewHtml(template: { header?: string; html?: string; footer?: string; css?: string }) {
    let html = (template.header || '') + (template.html || '') + (template.footer || '');
    const css = template.css || '';
    const sample = this.getSampleData();

    // Render line items either inside an existing <tbody> or as a standalone <table>
    if (html.includes('{{items}}')) {
      const rows = (sample.items as any[])
        .map((item) => {
          if (typeof item === 'object') {
            const { description, quantity, unit_price, amount, total } = item;
            return `<tr><td>${description ?? ''}</td><td>${quantity ?? ''}</td><td>${unit_price ?? ''}</td><td>${amount ?? total ?? ''}</td></tr>`;
          }
          return `<tr><td colspan="4">${item}</td></tr>`;
        })
        .join('');
      if (/<tbody[^>]*>\s*\{\{items\}\}\s*<\/tbody>/i.test(html)) {
        html = html.replace(/(<tbody[^>]*>)\s*\{\{items\}\}\s*(<\/tbody>)/i, `$1${rows}$2`);
      } else {
        html = html.replace(/\{\{items\}\}/g, `<table>${rows}</table>`);
      }
    }

    for (const [key, value] of Object.entries(sample)) {
      if (key === 'items') continue;
      const placeholder = `{{${key}}}`;
      if (html.includes(placeholder)) {
        html = html.split(placeholder).join(String(value ?? ''));
      }
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`;
  }

  async findAll(templateType?: string) {
    return this.cached(this.cacheKey('list', templateType ?? 'all'), async () => {
    let templates = await this.getTemplates();
    if (templateType) templates = templates.filter((t: any) => t.template_type === templateType);
    return { templates };
    });
  }

  async create(data: any) {
    const templates = await this.getTemplates();
    const normalized = normalizeTemplateData(data);
    const template = {
      id: Date.now(),
      ...normalized,
      is_default: data.is_default ?? templates.filter((t: any) => t.template_type === normalized.template_type).length === 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    templates.push(template);
    await this.saveTemplates(templates);
    return { template };
  }

  async update(id: number, data: any) {
    const templates = await this.getTemplates();
    const idx = templates.findIndex((t: any) => t.id === id);
    if (idx === -1) throw new NotFoundException('Template not found');
    const normalized = normalizeTemplateData({ ...templates[idx], ...data });
    templates[idx] = { ...templates[idx], ...normalized, updated_at: new Date().toISOString() };
    await this.saveTemplates(templates);
    return { template: templates[idx] };
  }

  async remove(id: number) {
    const templates = await this.getTemplates();
    const filtered = templates.filter((t: any) => t.id !== id);
    if (filtered.length === templates.length) throw new NotFoundException('Template not found');
    await this.saveTemplates(filtered);
    return { message: 'Template deleted' };
  }

  async setDefault(id: number) {
    const templates = await this.getTemplates();
    const target = templates.find((t: any) => t.id === id);
    if (!target) throw new NotFoundException('Template not found');
    for (const t of templates) {
      t.is_default = t.template_type === target.template_type && t.id === id;
      t.updated_at = new Date().toISOString();
    }
    await this.saveTemplates(templates);
    return { template: target };
  }

  async clone(id: number) {
    const templates = await this.getTemplates();
    const target = templates.find((t: any) => t.id === id);
    if (!target) throw new NotFoundException('Template not found');
    const clone = { ...target, id: Date.now(), name: `${target.name} (Copy)`, is_default: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    templates.push(clone);
    await this.saveTemplates(templates);
    return { template: clone };
  }

  async preview(id: number) {
    return this.cached(this.cacheKey('preview', id), async () => {
    const templates = await this.getTemplates();
    const template = templates.find((t: any) => t.id === id);
    if (!template) throw new NotFoundException('Template not found');
    return { success: true, preview_html: this.renderPreviewHtml(template), template };
    });
  }

  previewWithData(data: any) {
    const normalized = normalizeTemplateData(data);
    return { success: true, preview_html: this.renderPreviewHtml(normalized) };
  }

  async seedDefaults() {
    const templates = await this.getTemplates();
    if (templates.length > 0) {
      return { templates, message: 'Templates already exist' };
    }

    const defaults = [
      {
        name: 'Default Invoice',
        template_type: 'invoice',
        description: 'Standard invoice layout',
        html: DEFAULT_INVOICE_HTML,
        css: DEFAULT_INVOICE_CSS,
        header: DEFAULT_HEADER,
        footer: DEFAULT_FOOTER,
        is_default: true,
      },
      {
        name: 'Default Estimate',
        template_type: 'estimate',
        description: 'Standard estimate / quote layout',
        html: DEFAULT_INVOICE_HTML.replace(/\{\{document_title\}\}/g, 'ESTIMATE').replace(/Due Date:/g, 'Valid until:'),
        css: DEFAULT_INVOICE_CSS,
        header: DEFAULT_HEADER,
        footer: DEFAULT_FOOTER,
        is_default: true,
      },
      {
        name: 'Default Payslip',
        template_type: 'payslip',
        description: 'Standard employee payslip layout',
        html: DEFAULT_PAYSLIP_HTML.replace(/\{\{document_title\}\}/g, 'PAYSLIP'),
        css: DEFAULT_PAYSLIP_CSS,
        header: DEFAULT_HEADER,
        footer: DEFAULT_FOOTER,
        is_default: true,
      },
    ];

    const now = new Date().toISOString();
    const seeded = defaults.map((d, i) => ({
      id: Date.now() + i,
      ...d,
      created_at: now,
      updated_at: now,
    }));

    await this.saveTemplates(seeded);
    return { templates: seeded, message: 'Default templates created' };
  }
}
