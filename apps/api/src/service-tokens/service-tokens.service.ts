import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface UserLike {
  id: number;
  role: string;
}

@Injectable()
export class ServiceTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: UserLike) {
    this.ensureAdmin(user);
    const tokens = await this.prisma.service_tokens.findMany({
      select: {
        id: true,
        name: true,
        token_prefix: true,
        scopes: true,
        role: true,
        last_used_at: true,
        expires_at: true,
        revoked: true,
        created_at: true,
        created_by: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: tokens };
  }

  async create(user: UserLike, dto: Record<string, unknown>) {
    this.ensureAdmin(user);
    const name = this.asString(dto.name);
    if (!name?.trim()) throw new BadRequestException('Name is required');

    const rawToken = `cb_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.substring(0, 11);

    let expiresAt: Date | null = null;
    const expiresInDays = this.asNumber(dto.expires_in_days);
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const scopes = Array.isArray(dto.scopes) ? dto.scopes : ['bug_reports'];
    const role = this.asString(dto.role) || 'service';

    const token = await this.prisma.service_tokens.create({
      data: {
        name: name.trim(),
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        scopes: scopes as any,
        role: role as any,
        created_by: user.id,
        expires_at: expiresAt,
      },
    });

    return {
      success: true,
      message: 'Token created. Save this token — it will not be shown again.',
      data: {
        id: token.id,
        name: token.name,
        token: rawToken,
        token_prefix: token.token_prefix,
        scopes: token.scopes,
        role: token.role,
        expires_at: token.expires_at,
      },
    };
  }

  async revoke(user: UserLike, id: number) {
    this.ensureAdmin(user);
    const token = await this.prisma.service_tokens.findUnique({ where: { id } });
    if (!token) throw new NotFoundException('Token not found');
    await this.prisma.service_tokens.update({ where: { id }, data: { revoked: true } });
    return { success: true, message: `Token "${token.name}" revoked` };
  }

  private ensureAdmin(user: UserLike) {
    if (user.role !== 'admin') throw new ForbiddenException('Admin access required');
  }

  private asString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    return undefined;
  }

  private asNumber(value: unknown): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = Number(value);
      return Number.isNaN(num) ? undefined : num;
    }
    return undefined;
  }
}
