import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CompaniesService } from './companies.service';
import { GetCompaniesQueryDto } from '@clickbit/shared';

@Controller('crm/companies')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async findAll(
    @Query() query: GetCompaniesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    return this.companiesService.findAll(query);
  }
}
