import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto, AnalyticsQueryDto, ExportBigQueryDto, AudienceExportDto } from './dto/analytics.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  @UseGuards(OptionalAuthGuard)
  track(@Req() req: any, @Body() dto: TrackEventDto) {
    return this.analyticsService.track(req, dto as unknown as Record<string, unknown>);
  }

  @Get('dashboard')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  dashboard(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.dashboard(query.period);
  }

  @Get('events/:type')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  eventsByType(@Param('type') type: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.eventsByType(type, query.period);
  }

  @Get('pageviews')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  pageViews(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.pageViews(query.page_url, query.period);
  }

  @Get('users/:userId')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  userEvents(@Param('userId', ParseIntPipe) userId: number, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.userEvents(userId, query.period);
  }

  @Get('realtime')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  realtime() {
    return this.analyticsService.realtime();
  }

  @Post('export/bigquery')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  exportBigQuery(@Body() _dto: ExportBigQueryDto) {
    return this.analyticsService.exportBigQuery();
  }

  @Get('bigquery/status')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  bigQueryStatus() {
    return this.analyticsService.bigQueryStatus();
  }

  @Get('audiences')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  audiences() {
    return this.analyticsService.audiences();
  }

  @Get('audiences/:type')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  audienceUsers(@Param('type') type: string, @Query('limit') limit?: string) {
    return this.analyticsService.audienceUsers(type, Number(limit) || 100);
  }

  @Post('audiences/:type/export')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  exportAudience(@Param('type') type: string, @Body() dto: AudienceExportDto) {
    return this.analyticsService.exportAudience(type, dto.format);
  }

  @Get('recommendations')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  recommendations(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.recommendations(query.period);
  }

  @Get('google-ads/guide')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  googleAdsGuide() {
    return this.analyticsService.googleAdsGuide();
  }

  @Get('alerts')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  alerts() {
    return this.analyticsService.alerts();
  }
}
