import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { NotificationsService } from './notifications.service';
import {
  UptimeKumaWebhookDto,
  UpdateSiteStatusDto,
  SavePushTokenDto,
  ListNotificationsQueryDto,
} from './dto/notifications.dto';
import { setNoCache } from './notifications-utils';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('webhook/uptime-kuma')
  async webhook(
    @Body() dto: UptimeKumaWebhookDto,
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    if (!this.notificationsService.verifyWebhookToken(token)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    return this.notificationsService.handleUptimeKumaWebhook(dto as unknown as Record<string, unknown>);
  }

  @Get('webhook/uptime-kuma/test')
  webhookTest(@Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    return this.notificationsService.getWebhookTestInfo();
  }

  @Get('sites')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async findSites(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    return this.notificationsService.findSites(req.user);
  }

  @Put('sites/:id/status')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async updateSiteStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSiteStatusDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notificationsService.updateSiteStatus(id, req.user, dto.status);
  }

  @Delete('sites/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async removeSite(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notificationsService.removeSite(id, req.user);
  }

  @Delete('sites')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async removeAllSites(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    return this.notificationsService.removeAllSites(req.user);
  }

  @Delete('cleanup')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async cleanup(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    return this.notificationsService.cleanupNotifications(req.user);
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  async findNotifications(
    @Query() query: ListNotificationsQueryDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notificationsService.findNotifications(req.user, query.unread, query.limit);
  }

  @Put(':id/read')
  @UseGuards(SupabaseAuthGuard)
  async markRead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notificationsService.markRead(id, req.user);
  }

  @Put('read-all')
  @UseGuards(SupabaseAuthGuard)
  async markAllRead(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    return this.notificationsService.markAllRead(req.user);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notificationsService.remove(req.user, id);
  }

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async create(
    @Body() body: { title: string; message: string; type?: string; source?: string; user_id?: number; role?: string; broadcast?: boolean; metadata?: string },
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notificationsService.createNotification(req.user, body);
  }

  @Post('push-token')
  @UseGuards(SupabaseAuthGuard)
  async savePushToken(
    @Body() dto: SavePushTokenDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notificationsService.savePushToken(req.user, dto.pushToken);
  }

  @Get('push-token/status')
  @UseGuards(SupabaseAuthGuard)
  async pushTokenStatus(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    return this.notificationsService.getPushTokenStatus(req.user);
  }

  @Post('push-token/test')
  @UseGuards(SupabaseAuthGuard)
  async testPush(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notificationsService.testPushNotification(req.user);
  }
}
