import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto, MoveLeadDto, WinLeadDto, LoseLeadDto } from './dto';
import { setNoCache } from './crm-utils';
import { RequestWithUser } from '../types/request-with-user';

@Controller('crm/leads')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async findAll(
    @Query() query: {
      pipeline_id?: string;
      stage_id?: string;
      status?: string;
      owner_id?: string;
      search?: string;
      priority?: string;
      page?: string;
      limit?: string;
      sort?: string;
      order?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.findAll({
      ...query,
      pipeline_id: query.pipeline_id ? Number(query.pipeline_id) : undefined,
      stage_id: query.stage_id ? Number(query.stage_id) : undefined,
      owner_id: query.owner_id ? Number(query.owner_id) : undefined,
      page: Number(query.page || 1),
      limit: Number(query.limit || 50),
      order: (query.order?.toLowerCase() as 'asc' | 'desc') || 'DESC',
    });
  }

  @Post()
  async create(
    @Body() dto: CreateLeadDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.create(req.user.id, dto);
  }

  @Get('pipeline/:pipelineId')
  async getByPipeline(
    @Param('pipelineId', ParseIntPipe) pipelineId: number,
    @Query('status') status: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.getByPipeline(pipelineId, status);
  }

  @Get('hot')
  async getHot(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.getHot(Number(page || 1), Number(limit || 50));
  }

  @Get('uncontacted')
  async getUncontacted(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.getUncontacted(Number(page || 1), Number(limit || 50));
  }

  @Get('by-stage/:stage')
  async getByStage(
    @Param('stage', ParseIntPipe) stageId: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.getByStage(stageId, Number(page || 1), Number(limit || 50));
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeadDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.update(id, dto);
  }

  @Patch(':id/move')
  async move(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveLeadDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.move(id, dto);
  }

  @Post(':id/win')
  async win(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: WinLeadDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.win(id, dto, req.user.id);
  }

  @Post(':id/lose')
  async lose(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LoseLeadDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.lose(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.leadsService.delete(id);
  }

  @Post('recalculate-scores')
  async recalculateScores(@Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    return this.leadsService.recalculateScores();
  }

  @Post('auto-assign')
  async autoAssign(@Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    return this.leadsService.autoAssign();
  }
}
