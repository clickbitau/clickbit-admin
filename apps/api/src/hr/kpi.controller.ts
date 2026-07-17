import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { KpiService } from './kpi.service';

@Controller('hr/kpi')
@UseGuards(SupabaseAuthGuard)
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'hr')
  async dashboard(@Query('period') period: string, @Req() req: RequestWithUser) {
    const p = period || new Date().toISOString().substring(0, 7);
    return this.kpiService.dashboard(p, req.user);
  }

  @Get('employee/:id')
  async employeeHistory(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.kpiService.employeeHistory(id, req.user);
  }

  @Post('snapshot')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'hr')
  async snapshot(@Body() body: { period?: string; employee_ids?: number[] }, @Req() req: RequestWithUser) {
    const period = body?.period || new Date().toISOString().substring(0, 7);
    return this.kpiService.snapshot(period, req.user, body?.employee_ids);
  }

  @Get('live/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'hr')
  async live(
    @Param('id', ParseIntPipe) id: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.kpiService.live(id, startDate, endDate);
  }
}
