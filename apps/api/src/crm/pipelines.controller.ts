import {
  Controller,
  Get,
  Post,
  Put,
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
import { PipelinesService } from './pipelines.service';
import { CreatePipelineDto, UpdatePipelineDto, UpdatePipelineStagesDto } from './dto';
import { setNoCache } from './crm-utils';
import { RequestWithUser } from '../types/request-with-user';

@Controller('crm/pipelines')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  async findAll(
    @Query() query: { search?: string; pipeline_type?: string; is_active?: string; page?: string; limit?: string; sortBy?: string; sortOrder?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.pipelinesService.findAll({
      ...query,
      page: Number(query.page || 1),
      limit: Number(query.limit || 50),
    });
  }

  @Post()
  async create(
    @Body() dto: CreatePipelineDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const pipeline = await this.pipelinesService.create(req.user.id, dto);
    res.status(201);
    return pipeline;
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.pipelinesService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePipelineDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.pipelinesService.update(id, dto);
  }

  @Put(':id/stages')
  async updateStages(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePipelineStagesDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.pipelinesService.updateStages(id, dto);
  }
}
