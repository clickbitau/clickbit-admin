import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards, ParseIntPipe, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequestWithUser } from '../types/request-with-user';
import { RemindersService } from './reminders.service';
import { CreateReminderDto, GetListQueryDto, UpdateReminderDto } from './dto/hr.dto';
import { setNoCache } from './hr-utils';

@Controller('hr/reminders')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  async findAll(@Query() query: GetListQueryDto, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.remindersService.findAll(query));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.remindersService.findOne(id));
  }

  @Post()
  async create(@Body() dto: CreateReminderDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    const result = await this.remindersService.create(dto as unknown as Record<string, unknown>, req.user);
    return res.status(HttpStatus.CREATED).json(result);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReminderDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.remindersService.update(id, dto as unknown as Record<string, unknown>, req.user));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.remindersService.remove(id, req.user));
  }

  @Post(':id/complete')
  async complete(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.remindersService.complete(id, req.user));
  }
}
