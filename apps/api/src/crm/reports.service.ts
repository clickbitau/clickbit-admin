import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from './crm-utils';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getForecast(pipelineId?: number, period = 'month') {
    const pipelineFilter = pipelineId ? `AND d.pipeline_id = ${pipelineId}` : '';
    const periodColumn = period === 'week' ? "DATE_TRUNC('week', d.expected_close_date)" : "DATE_TRUNC('month', d.expected_close_date)";

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ period: Date; total_value: number; weighted_value: number; deal_count: number }>
    >( `
      SELECT
        ${periodColumn} as period,
        COALESCE(SUM(d.value), 0) as total_value,
        COALESCE(SUM(d.value * d.probability / 100.0), 0) as weighted_value,
        COUNT(*) as deal_count
      FROM deals d
      WHERE d.deleted_at IS NULL
        AND d.status = 'open'
        AND d.expected_close_date IS NOT NULL
        ${pipelineFilter}
      GROUP BY period
      ORDER BY period ASC
    `);

    return {
      forecast: rows.map((r) => ({
        period: r.period,
        total_value: toNumber(r.total_value),
        weighted_value: toNumber(r.weighted_value),
        deal_count: Number(r.deal_count),
      })),
    };
  }

  async getVelocity(pipelineId?: number, status?: 'won' | 'lost' | 'all') {
    const statusFilter = status && status !== 'all' ? `AND d.status = '${status}'` : `AND d.status IN ('won', 'lost')`;
    const pipelineFilter = pipelineId ? `AND d.pipeline_id = ${pipelineId}` : '';

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ stage_id: number; stage_name: string; avg_days: number; total_deals: number }>
    >( `
      SELECT
        s.id as stage_id,
        s.name as stage_name,
        AVG(EXTRACT(EPOCH FROM (d.updated_at - d.created_at)) / 86400.0) as avg_days,
        COUNT(*) as total_deals
      FROM deals d
      JOIN crm_pipeline_stages s ON d.stage_id = s.id
      WHERE d.deleted_at IS NULL
        ${statusFilter}
        ${pipelineFilter}
      GROUP BY s.id, s.name
      ORDER BY s.position ASC
    `);

    return {
      velocity: rows.map((r) => ({
        stage_id: r.stage_id,
        stage_name: r.stage_name,
        avg_days: Math.round((Number(r.avg_days) || 0) * 10) / 10,
        total_deals: Number(r.total_deals),
      })),
    };
  }
}
