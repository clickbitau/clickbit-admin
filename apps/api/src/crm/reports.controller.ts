import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReportsService } from './reports.service';
import { setNoCache } from './crm-utils';

@Controller('crm/reports')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('forecast')
  async getForecast(
    @Query('pipeline_id') pipelineId: string,
    @Query('period') period: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.reportsService.getForecast(
      pipelineId ? Number(pipelineId) : undefined,
      period || 'month',
    );
  }

  @Get('velocity')
  async getVelocity(
    @Query('pipeline_id') pipelineId: string,
    @Query('status') status: 'won' | 'lost' | 'all',
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.reportsService.getVelocity(
      pipelineId ? Number(pipelineId) : undefined,
      status,
    );
  }
}
