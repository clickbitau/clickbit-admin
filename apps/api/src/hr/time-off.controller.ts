import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { TimeOffService } from './time-off.service';
import { CreateTimeOffDto, GetListQueryDto, TimeOffActionDto } from './dto/hr.dto';
import { setNoCache } from './hr-utils';

@Controller('hr/time-off')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class TimeOffController {
  constructor(private readonly timeOffService: TimeOffService) {}

  @Get('calendar')
  async calendar(@Query() query: { start_date?: string; end_date?: string }, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeOffService.calendar(query));
  }

  @Get()
  async findAll(@Query() query: GetListQueryDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeOffService.findAll(query, req.user));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeOffService.findOne(id));
  }

  @Post()
  async create(@Body() dto: CreateTimeOffDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeOffService.create(dto as unknown as Record<string, unknown>, req.user));
  }

  @Post(':id/approve')
  @Roles('admin', 'manager')
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TimeOffActionDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.timeOffService.approve(id, dto as unknown as Record<string, unknown>, req.user));
  }

  @Post(':id/reject')
  @Roles('admin', 'manager')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TimeOffActionDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.timeOffService.reject(id, dto as unknown as Record<string, unknown>, req.user));
  }

  @Post(':id/revoke')
  @Roles('admin')
  async revoke(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TimeOffActionDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.timeOffService.revoke(id, dto as unknown as Record<string, unknown>, req.user));
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timeOffService.cancel(id, req.user));
  }
}
