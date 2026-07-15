import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealFromOrderDto, LinkInvoiceProjectDto } from './dto';
import { asJsonInput } from './crm-utils';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  async createDealFromOrder(orderId: number, dto: CreateDealFromOrderDto, userId: number) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: { order_items: { include: { products: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const pipeline = await this.getDefaultPipeline(dto.pipeline_id);
    const stage = await this.getDefaultStage(pipeline.id, dto.stage_id);

    const title = dto.title || `Deal from order ${order.order_number}`;

    const deal = await this.prisma.deals.create({
      data: {
        deal_number: `DEAL-${Date.now()}`,
        title,
        value: Number(order.total_amount || 0),
        currency: order.currency || 'AUD',
        pipeline_id: pipeline.id,
        stage_id: stage.id,
        contact_id: order.contact_id,
        company_id: order.company_id,
        owner_id: userId,
        lead_source: 'order_integration',
        status: 'open',
        priority: 'medium',
        custom_fields: asJsonInput({ order_id: order.id, order_number: order.order_number }),
        tags: asJsonInput([]),
      } as unknown as Prisma.dealsUncheckedCreateInput,
    });

    if (order.contact_id) {
      await this.prisma.crm_deal_contacts.upsert({
        where: { deal_id_contact_id: { deal_id: deal.id, contact_id: order.contact_id } },
        create: { deal_id: deal.id, contact_id: order.contact_id, is_primary: true },
        update: { is_primary: true },
      });
    }

    await this.prisma.crm_deal_stage_history.create({
      data: { deal_id: deal.id, from_stage_id: null, to_stage_id: stage.id, changed_by: userId, note: 'Deal created from order' },
    });

    return { data: deal };
  }

  async createDealFromCustomPackage(packageId: number, dto: CreateDealFromOrderDto, userId: number) {
    const pkg = await this.prisma.invoices.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Custom package not found');

    const pipeline = await this.getDefaultPipeline(dto.pipeline_id);
    const stage = await this.getDefaultStage(pipeline.id, dto.stage_id);

    const title = dto.title || pkg.title || `Deal from package ${pkg.package_code}`;

    const deal = await this.prisma.deals.create({
      data: {
        deal_number: `DEAL-${Date.now()}`,
        title,
        value: Number(pkg.total_amount || 0),
        currency: pkg.currency || 'AUD',
        pipeline_id: pipeline.id,
        stage_id: stage.id,
        contact_id: pkg.contact_id,
        company_id: pkg.company_id,
        owner_id: userId,
        lead_source: 'custom_package_integration',
        status: 'open',
        priority: 'medium',
        custom_fields: asJsonInput({ custom_package_id: pkg.id, package_code: pkg.package_code }),
        tags: asJsonInput([]),
      } as unknown as Prisma.dealsUncheckedCreateInput,
    });

    if (pkg.contact_id) {
      await this.prisma.crm_deal_contacts.upsert({
        where: { deal_id_contact_id: { deal_id: deal.id, contact_id: pkg.contact_id } },
        create: { deal_id: deal.id, contact_id: pkg.contact_id, is_primary: true },
        update: { is_primary: true },
      });
    }

    await this.prisma.crm_deal_stage_history.create({
      data: { deal_id: deal.id, from_stage_id: null, to_stage_id: stage.id, changed_by: userId, note: 'Deal created from custom package' },
    });

    await this.prisma.invoices.update({
      where: { id: packageId },
      data: { deal_id: deal.id },
    });

    return { data: deal };
  }

  async fixInvoiceProjectLinks() {
    const invoices = await this.prisma.invoices.findMany({
      where: { project_id: null, deleted_at: null },
      select: { id: true, company_id: true, contact_id: true },
    });

    let linked = 0;
    for (const invoice of invoices) {
      const project = await this.prisma.crm_projects.findFirst({
        where: {
          deleted_at: null,
          OR: [
            { company_id: invoice.company_id },
            { customer_id: invoice.contact_id },
          ],
        },
        orderBy: { created_at: 'desc' },
      });

      if (project) {
        await this.prisma.invoices.update({
          where: { id: invoice.id },
          data: { project_id: project.id, crm_project_id: project.id },
        });
        linked++;
      }
    }

    return { message: `Linked ${linked} invoices to projects` };
  }

  async linkInvoiceProject(invoiceId: number, dto: LinkInvoiceProjectDto) {
    const invoice = await this.prisma.invoices.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const project = await this.prisma.crm_projects.findUnique({ where: { id: dto.project_id } });
    if (!project) throw new NotFoundException('Project not found');

    await this.prisma.invoices.update({
      where: { id: invoiceId },
      data: { project_id: dto.project_id, crm_project_id: dto.project_id },
    });

    return { message: 'Invoice linked to project' };
  }

  private async getDefaultPipeline(pipelineId?: number) {
    if (pipelineId) {
      const p = await this.prisma.crm_pipelines.findUnique({ where: { id: pipelineId } });
      if (!p) throw new BadRequestException('Pipeline not found');
      return p;
    }
    const p = await this.prisma.crm_pipelines.findFirst({ where: { is_active: true }, orderBy: { created_at: 'asc' } });
    if (!p) throw new BadRequestException('No active pipeline found');
    return p;
  }

  private async getDefaultStage(pipelineId: number, stageId?: number) {
    if (stageId) {
      const s = await this.prisma.crm_pipeline_stages.findUnique({ where: { id: stageId } });
      if (!s || s.pipeline_id !== pipelineId) throw new BadRequestException('Invalid stage');
      return s;
    }
    const s = await this.prisma.crm_pipeline_stages.findFirst({
      where: { pipeline_id: pipelineId, is_active: true },
      orderBy: { position: 'asc' },
    });
    if (!s) throw new BadRequestException('Pipeline has no stages');
    return s;
  }
}
