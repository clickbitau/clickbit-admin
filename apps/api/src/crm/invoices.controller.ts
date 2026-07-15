import { Controller, Post, Put, Param, Body, UseGuards, Res, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IntegrationsService } from './integrations.service';
import { LinkInvoiceProjectDto } from './dto';
import { setNoCache } from './crm-utils';

@Controller('crm/invoices')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class InvoicesController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('fix-project-links')
  async fixProjectLinks(@Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    return this.integrationsService.fixInvoiceProjectLinks();
  }

  @Put(':id/link-project')
  async linkProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkInvoiceProjectDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.integrationsService.linkInvoiceProject(id, dto);
  }
}
