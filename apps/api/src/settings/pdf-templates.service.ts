import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const KEY = 'pdf_templates';

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
  constructor(private readonly prisma: PrismaService) {}

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
  }

  private getSampleData(): Record<string, any> {
    return {
      invoice_number: 'INV-0001',
      quote_number: 'QT-0001',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      client_name: 'Sample Client',
      client_email: 'client@example.com',
      company_name: 'ClickBit Pty Ltd',
      company_address: '19 Drysdale Approach, Baldivis WA 6171',
      company_phone: '02 7229 9577',
      company_email: 'info@clickbit.com.au',
      items: [
        { description: 'Sample service', quantity: 1, unit_price: 100, amount: 100 },
        { description: 'Additional work', quantity: 2, unit_price: 50, amount: 100 },
      ],
      subtotal: 200,
      tax: 20,
      total: 220,
      amount_due: 220,
      notes: 'Sample notes',
      payment_terms: '7 days',
      employee_name: 'Jane Employee',
      pay_period: '01 Jul 2026 - 15 Jul 2026',
      gross_pay: 2500,
      net_pay: 2100,
      tax_deduction: 400,
    };
  }

  private renderPreviewHtml(template: { header?: string; html?: string; footer?: string; css?: string }) {
    let html = (template.header || '') + (template.html || '') + (template.footer || '');
    const css = template.css || '';
    const sample = this.getSampleData();

    for (const [key, value] of Object.entries(sample)) {
      const placeholder = `{{${key}}}`;
      if (html.includes(placeholder)) {
        if (Array.isArray(value)) {
          const rows = value
            .map((item) => {
              const cells = typeof item === 'object' ? Object.values(item) : [item];
              return `<tr>${cells.map((v) => `<td>${v}</td>`).join('')}</tr>`;
            })
            .join('');
          html = html.split(placeholder).join(`<table>${rows}</table>`);
        } else {
          html = html.split(placeholder).join(String(value ?? ''));
        }
      }
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`;
  }

  async findAll(templateType?: string) {
    let templates = await this.getTemplates();
    if (templateType) templates = templates.filter((t: any) => t.template_type === templateType);
    return { templates };
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
    const templates = await this.getTemplates();
    const template = templates.find((t: any) => t.id === id);
    if (!template) throw new NotFoundException('Template not found');
    return { success: true, preview_html: this.renderPreviewHtml(template), template };
  }

  previewWithData(data: any) {
    const normalized = normalizeTemplateData(data);
    return { success: true, preview_html: this.renderPreviewHtml(normalized) };
  }
}
