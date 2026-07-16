import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const KEY = 'pdf_templates';

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

  async findAll(templateType?: string) {
    let templates = await this.getTemplates();
    if (templateType) templates = templates.filter((t: any) => t.template_type === templateType);
    return { templates };
  }

  async create(data: any) {
    const templates = await this.getTemplates();
    const template = {
      id: Date.now(),
      name: data.name,
      template_type: data.template_type || 'invoice',
      html: data.html || '',
      css: data.css || '',
      header: data.header || '',
      footer: data.footer || '',
      is_default: templates.filter((t: any) => t.template_type === data.template_type).length === 0,
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
    templates[idx] = { ...templates[idx], ...data, updated_at: new Date().toISOString() };
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
    return { success: true, message: 'PDF preview not implemented in this pass', template };
  }
}
