import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards, ParseIntPipe, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementCommentDto, AnnouncementReactionDto, CreateAnnouncementDto, GetListQueryDto, UpdateAnnouncementDto } from './dto/hr.dto';
import { setNoCache } from './hr-utils';

@Controller('hr/announcements')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get('public')
  async findPublic(@Query() query: GetListQueryDto, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.announcementsService.findPublic(query));
  }

  @Get()
  async findAll(@Query() query: GetListQueryDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.announcementsService.findAll(query, req.user));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.announcementsService.findOne(id));
  }

  @Post()
  @Roles('admin', 'manager')
  async create(@Body() dto: CreateAnnouncementDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    const result = await this.announcementsService.create(dto as unknown as Record<string, unknown>, req.user);
    return res.status(HttpStatus.CREATED).json(result);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.announcementsService.update(id, dto as unknown as Record<string, unknown>, req.user));
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.announcementsService.remove(id, req.user));
  }

  @Post(':id/publish')
  @Roles('admin', 'manager')
  async publish(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.announcementsService.publish(id, req.user));
  }

  @Post(':id/acknowledge')
  async acknowledge(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.announcementsService.acknowledge(id, req.user));
  }

  @Post(':id/react')
  async react(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnnouncementReactionDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.announcementsService.react(id, dto, req.user));
  }

  @Post(':id/comment')
  async comment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnnouncementCommentDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.announcementsService.comment(id, dto, req.user));
  }
}
