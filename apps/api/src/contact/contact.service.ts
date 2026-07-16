import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function asStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(dto: Record<string, unknown>) {
    const type = asStr(dto.type) || 'contact';
    const firstName = asStr(dto.firstName) || '';
    const lastName = asStr(dto.lastName) || '';
    const rawName = asStr(dto.name);
    const name = rawName || `${firstName} ${lastName}`.trim() || 'Unknown';
    const email = (asStr(dto.email) || '').toLowerCase().trim();
    const phone = asStr(dto.phone) || null;
    const message = asStr(dto.message) || '';
    const subject = asStr(dto.subject) || '';
    const company = asStr(dto.company) || null;
    const website = asStr(dto.website) || null;

    let contact = email ? await this.prisma.contacts.findFirst({ where: { email } }) : null;
    if (!contact) {
      contact = await this.prisma.contacts.create({
        data: {
          name,
          email,
          phone,
          subject: subject || 'Website Contact Form Submission',
          message,
          contact_type: type,
          priority: 'medium',
          status: 'new',
          source: 'Website Contact Form',
          lifecycle_stage: 'lead',
          lead_status: 'new',
          company,
          website,
          custom_fields: JSON.stringify(dto.metadata || {}),
        },
      });
    }

    let lead: any = null;
    if (type !== 'newsletter') {
      const pipeline = await this.prisma.crm_pipelines.findFirst({ where: { is_default: true, is_active: true } });
      const stage = pipeline
        ? await this.prisma.crm_pipeline_stages.findFirst({
            where: { pipeline_id: pipeline.id, is_won: false, is_lost: false, is_active: true },
            orderBy: { position: 'asc' },
          })
        : null;

      if (pipeline && stage) {
        lead = await this.prisma.crm_leads.create({
          data: {
            lead_number: `LEAD-${Date.now()}`,
            name,
            email,
            phone,
            company_name: company,
            website,
            description: message,
            requirements: JSON.stringify(dto.metadata || {}),
            pipeline_id: pipeline.id,
            stage_id: stage.id,
            contact_id: contact.id,
            lead_source: 'Website Contact Form',
            status: 'open',
            priority: 'medium',
          },
        });
      }
    }

    return { success: true, data: { contact, lead, message: 'Submission received' } };
  }
}
