import { Controller, Post, Param, Body, UseGuards, Res, Req, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IntegrationsService } from './integrations.service';
import { CreateDealFromOrderDto } from './dto';
import { setNoCache } from './crm-utils';
import { RequestWithUser } from '../types/request-with-user';

@Controller('crm/integrations')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('order/:orderId/create-deal')
  async createDealFromOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: CreateDealFromOrderDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.integrationsService.createDealFromOrder(orderId, dto, req.user.id);
  }

  @Post('custom-package/:packageId/create-deal')
  async createDealFromCustomPackage(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Body() dto: CreateDealFromOrderDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.integrationsService.createDealFromCustomPackage(packageId, dto, req.user.id);
  }
}
