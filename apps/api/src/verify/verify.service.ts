import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VerifyService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(code: string, clientIp?: string) {
    if (!code || code.length < 5) {
      return { valid: false, error: 'Invalid verification code format' };
    }
    const row = await this.prisma.document_verifications.findUnique({
      where: { verification_code: code.toUpperCase() },
    });
    if (!row || row.is_voided) {
      return { valid: false, error: 'Verification code not found' };
    }
    await this.prisma.document_verifications.update({
      where: { id: row.id },
      data: {
        verified_count: { increment: 1 },
        last_verified_at: new Date(),
        last_verified_ip: clientIp || null,
      },
    });
    return {
      valid: true,
      document: {
        id: row.id,
        document_type: row.document_type,
        document_number: row.document_number,
        issued_to_name: row.issued_to_name,
        issued_to_company: row.issued_to_company,
        issued_date: row.issued_date,
        amount: row.amount,
        currency: row.currency,
        verified_count: (row.verified_count ?? 0) + 1,
        last_verified_at: new Date(),
      },
    };
  }

  async exists(code: string) {
    const row = await this.prisma.document_verifications.findUnique({
      where: { verification_code: code.toUpperCase() },
      select: { id: true },
    });
    return !!row;
  }

  async stats() {
    const rows = await this.prisma.document_verifications.groupBy({
      by: ['document_type'],
      _count: { id: true },
      _sum: { verified_count: true },
    });
    return {
      stats: rows.map((r) => ({
        document_type: r.document_type,
        count: r._count.id,
        total_verifications: r._sum.verified_count ?? 0,
      })),
    };
  }
}
