import { Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors, Req, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { TimeClockService } from './time-clock.service';
import { setNoCache } from './hr-utils';
import { ClockInDto, ClockOutDto, BreakDto, BreadcrumbDto } from './dto/time-clock.dto';

@Controller('hr/time-clock')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('employee', 'manager', 'admin')
export class TimeClockController {
  constructor(private readonly timeClockService: TimeClockService) {}

  @Get('status')
  async status(@Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeClockService.status(req.user));
  }

  @Post('auto-clock-in')
  async autoClockIn(@Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeClockService.autoClockIn(req.user, req));
  }

  @Post('upload-photo')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.timeClockService.uploadPhoto(req.user, file));
  }

  @Post('clock-in')
  async clockIn(@Body() dto: ClockInDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeClockService.clockIn(req.user, dto, req));
  }

  @Post('clock-out')
  async clockOut(@Body() dto: ClockOutDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeClockService.clockOut(req.user, dto));
  }

  @Post('start-break')
  async startBreak(@Body() dto: BreakDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeClockService.startBreak(req.user, dto.break_type));
  }

  @Post('end-break')
  async endBreak(@Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeClockService.endBreak(req.user));
  }

  @Get('active')
  @Roles('manager', 'admin')
  async active(@Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeClockService.activeEntries(req.user));
  }

  @Post('breadcrumb')
  async breadcrumb(@Body() dto: BreadcrumbDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeClockService.addBreadcrumb(req.user, dto));
  }
}
