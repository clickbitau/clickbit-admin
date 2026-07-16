import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { SettingsService } from './settings.service';
import { SettingCreateDto } from './dto/settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public/billing-settings')
  @UseGuards(OptionalAuthGuard)
  getPublicBilling() { return this.settingsService.getPublicBillingSettings(); }

  @Get('public')
  @UseGuards(OptionalAuthGuard)
  getPublic() { return this.settingsService.getPublicSettings(); }

  @Get('public/:key')
  @UseGuards(OptionalAuthGuard)
  getPublicKey(@Param('key') key: string) { return this.settingsService.getPublicSetting(key); }

  @Get('admin/all')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getAdminAll(@Query() query: Record<string, unknown>) { return this.settingsService.findAllAdmin(query); }

  @Get('admin/type/:type')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getAdminByType(@Param('type') type: string) { return this.settingsService.findByType(type); }

  @Get('admin/:key')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getAdminByKey(@Param('key') key: string) { return this.settingsService.findByKey(key); }

  @Put('admin/:key')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  upsertSetting(@Param('key') key: string, @Body() dto: SettingCreateDto) { return this.settingsService.upsert(key, dto); }

  @Put('admin/bulk')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  bulkUpdate(@Body() body: any) { return this.settingsService.bulkUpdate(body); }

  @Delete('admin/:key')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  deleteSetting(@Param('key') key: string) { return this.settingsService.remove(key); }

  @Get('marketing-integrations')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getMarketingIntegrations() { return this.settingsService.getMarketingIntegrations(); }

  @Put('marketing-integrations')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  updateMarketingIntegrations(@Body() body: any) { return this.settingsService.updateMarketingIntegrations(body); }

  @Get('billing-settings')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getBillingSettings() { return this.settingsService.getBillingSettings(); }

  @Put('billing-settings')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  updateBillingSettings(@Body() body: any) { return this.settingsService.updateBillingSettings(body); }
}
