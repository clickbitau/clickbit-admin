import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

function maskCode(code: string) {
  if (!code) return '';
  const parts = code.split('-');
  if (parts.length === 4) {
    return `${parts[0]}-${parts[1]}-••••-${parts[3].slice(-4)}`;
  }
  return code.slice(0, 6) + '••••' + code.slice(-4);
}

function serializeCode(row: any, mask = true) {
  return {
    id: row.id,
    code: mask ? maskCode(row.code) : row.code,
    customerId: row.customer_id,
    tier: row.tier,
    maxNodes: row.max_nodes,
    maxServices: row.max_services,
    status: row.status,
    instanceId: row.instance_id,
    hostname: row.hostname,
    issuedAt: row.issued_at,
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
  };
}

function generateCode() {
  const bytes = randomBytes(8);
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    parts.push(bytes.slice(i * 2, i * 2 + 2).toString('hex').toUpperCase());
  }
  return parts.join('-');
}

@Injectable()
export class ClickdeployService {
  constructor(private readonly prisma: PrismaService) {}

  private async findCodeByCode(code: string) {
    return this.prisma.clickdeploy_codes.findUnique({ where: { code } });
  }

  async activate({ code, instanceId, hostname }: { code?: string; instanceId?: string; hostname?: string }) {
    if (!code) return { valid: false, error: 'Code is required' };
    const row = await this.findCodeByCode(code.toUpperCase());
    if (!row) return { valid: false, error: 'Invalid code' };
    if (row.status === 'revoked') return { valid: false, error: 'Code has been revoked' };
    if (row.expires_at && new Date(row.expires_at) < new Date()) return { valid: false, error: 'Code has expired' };
    const update: any = { instance_id: instanceId || row.instance_id, hostname: hostname || row.hostname, last_seen_at: new Date() };
    if (!row.activated_at) update.activated_at = new Date();
    await this.prisma.clickdeploy_codes.update({ where: { id: row.id }, data: update });
    return { valid: true, message: 'Activation successful' };
  }

  async heartbeat({ code, instanceId, hostname }: { code?: string; instanceId?: string; hostname?: string }) {
    if (!code) return { valid: false, error: 'Code is required' };
    const row = await this.findCodeByCode(code.toUpperCase());
    if (!row) return { valid: false, error: 'Invalid code' };
    if (row.status === 'revoked') return { valid: false, error: 'Code has been revoked' };
    if (row.expires_at && new Date(row.expires_at) < new Date()) return { valid: false, error: 'Code has expired' };
    await this.prisma.clickdeploy_codes.update({
      where: { id: row.id },
      data: { instance_id: instanceId || row.instance_id, hostname: hostname || row.hostname, last_seen_at: new Date() },
    });
    return { valid: true, message: 'Heartbeat successful' };
  }

  async listCustomers() {
    const rows = await this.prisma.clickdeploy_customers.findMany({
      include: { clickdeploy_codes: true },
      orderBy: { created_at: 'desc' },
    });
    return {
      customers: rows.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        notes: c.notes,
        createdAt: c.created_at,
        codes: (c.clickdeploy_codes || []).map((code: any) => serializeCode(code)),
      })),
    };
  }

  async createCustomer(data: { name: string; email?: string; notes?: string }) {
    if (!data.name) throw new BadRequestException('name is required');
    const row = await this.prisma.clickdeploy_customers.create({ data: { name: data.name, email: data.email, notes: data.notes } as any });
    return { customer: row };
  }

  async updateCustomer(id: number, data: { name?: string; email?: string; notes?: string }) {
    const existing = await this.prisma.clickdeploy_customers.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Customer not found');
    if (data.name !== undefined && !String(data.name).trim()) throw new BadRequestException('name cannot be empty');
    const row = await this.prisma.clickdeploy_customers.update({ where: { id }, data });
    return { customer: row };
  }

  async issueCode(data: { customerId: number; tier?: string; expiresIn?: number; maxNodes?: number; maxServices?: number }) {
    if (!data.customerId) throw new BadRequestException('customerId is required');
    const customer = await this.prisma.clickdeploy_customers.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    const code = generateCode();
    const expiresAt = data.expiresIn ? new Date(Date.now() + data.expiresIn * 24 * 60 * 60 * 1000) : null;
    // Supersede prior active codes
    await this.prisma.clickdeploy_codes.updateMany({
      where: { customer_id: data.customerId, status: 'active' },
      data: { status: 'superseded' } as any,
    });
    const row = await this.prisma.clickdeploy_codes.create({
      data: {
        code,
        customer_id: data.customerId,
        tier: data.tier || 'PRO',
        max_nodes: data.maxNodes ?? null,
        max_services: data.maxServices ?? null,
        expires_at: expiresAt,
      } as any,
    });
    return { code: serializeCode(row, false) };
  }

  async revealCode(id: number) {
    const row = await this.prisma.clickdeploy_codes.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Code not found');
    return { code: row.code };
  }

  async updateSubscription(id: number, data: { tier?: string; expiresIn?: number; maxNodes?: number; maxServices?: number }) {
    const existing = await this.prisma.clickdeploy_codes.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Code not found');
    const update: any = {};
    if (data.tier) update.tier = data.tier;
    if (data.maxNodes !== undefined) update.max_nodes = data.maxNodes;
    if (data.maxServices !== undefined) update.max_services = data.maxServices;
    if (data.expiresIn) update.expires_at = new Date(Date.now() + data.expiresIn * 24 * 60 * 60 * 1000);
    const row = await this.prisma.clickdeploy_codes.update({ where: { id }, data: update });
    return { code: serializeCode(row) };
  }

  async revokeCode(id: number) {
    const existing = await this.prisma.clickdeploy_codes.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Code not found');
    const row = await this.prisma.clickdeploy_codes.update({ where: { id }, data: { status: 'revoked' } });
    return { code: serializeCode(row) };
  }
}
