import { Controller, Get, Query, UseGuards, Res, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CrmService } from './crm.service';
import { setNoCache } from './crm-utils';

@Controller('crm')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('dashboard')
  async dashboard(
    @Query('period') period: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.crmService.dashboard(period ? Number(period) : 30);
  }

  @Get('customers')
  async customers(
    @Query() query: {
      page?: string;
      limit?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.crmService.customers({
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
      search: query.search,
      sortBy: query.sortBy || 'created_at',
      sortOrder: query.sortOrder || 'DESC',
    });
  }
}
