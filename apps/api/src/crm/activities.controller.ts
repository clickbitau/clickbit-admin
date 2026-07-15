import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  Res,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ActivitiesService } from './activities.service';
import { GetActivitiesQueryDto, CreateActivityDto, UpdateActivityDto, CompleteActivityDto } from './dto';
import { setNoCache } from './crm-utils';
import { RequestWithUser } from '../types/request-with-user';

@Controller('crm/activities')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  async findAll(
    @Query() query: GetActivitiesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.activitiesService.findAll({
      ...query,
      page: Number(query.page || 1),
      limit: Number(query.limit || 50),
    });
  }

  @Post()
  async create(
    @Body() dto: CreateActivityDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const activity = await this.activitiesService.create(req.user.id, dto);
    res.status(201);
    return activity;
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.activitiesService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActivityDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.activitiesService.update(id, dto);
  }

  @Put(':id/complete')
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteActivityDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.activitiesService.complete(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.activitiesService.delete(id);
  }
}
