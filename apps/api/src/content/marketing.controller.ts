import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MarketingService } from './marketing.service';

@Controller('marketing-posts')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('admin')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminAll(@Query() query: Record<string, unknown>) {
    return this.marketingService.findAllAdmin(query);
  }

  @Post('admin')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  create(@Req() req: any, @Body() dto: any) {
    return this.marketingService.create(req.user, dto as Record<string, unknown>);
  }

  @Put('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.marketingService.update(id, dto as Record<string, unknown>);
  }

  @Delete('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.marketingService.remove(id);
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Query() query: Record<string, unknown>) {
    return this.marketingService.listPublic(query);
  }
}
