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
import { DealsService } from './deals.service';
import {
  CreateDealDto,
  UpdateDealDto,
  MoveDealDto,
  WonDealDto,
  LostDealDto,
  BulkUpdateDealsDto,
  BulkDeleteDealsDto,
  CreateProjectFromDealDto,
} from './dto';
import { setNoCache } from './crm-utils';
import { RequestWithUser } from '../types/request-with-user';

@Controller('crm/deals')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  async findAll(
    @Query() query: {
      pipeline_id?: string;
      stage_id?: string;
      status?: 'open' | 'won' | 'lost';
      owner_id?: string;
      company_id?: string;
      contact_id?: string;
      search?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      page?: string;
      limit?: string;
      sortBy?: string;
      sortOrder?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.findAll({
      ...query,
      pipeline_id: query.pipeline_id ? Number(query.pipeline_id) : undefined,
      stage_id: query.stage_id ? Number(query.stage_id) : undefined,
      owner_id: query.owner_id ? Number(query.owner_id) : undefined,
      company_id: query.company_id ? Number(query.company_id) : undefined,
      contact_id: query.contact_id ? Number(query.contact_id) : undefined,
      page: Number(query.page || 1),
      limit: Number(query.limit || 50),
    });
  }

  @Post()
  async create(
    @Body() dto: CreateDealDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const deal = await this.dealsService.create(req.user.id, dto);
    res.status(201);
    return deal;
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.findOne(id);
  }

  @Get(':id/related')
  async getRelated(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.getRelated(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDealDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.update(id, dto);
  }

  @Put(':id/move')
  async move(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveDealDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.move(id, dto, req.user.id);
  }

  @Put(':id/won')
  async won(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: WonDealDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.won(id, dto, req.user.id);
  }

  @Put(':id/lost')
  async lost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LostDealDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.lost(id, dto, req.user.id);
  }

  @Put(':id/reopen')
  async reopen(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.reopen(id, req.user.id);
  }

  @Delete(':id')
  @Roles('admin')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.delete(id);
  }

  @Post('bulk-update')
  async bulkUpdate(
    @Body() dto: BulkUpdateDealsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.bulkUpdate(dto);
  }

  @Post('bulk-delete')
  @Roles('admin')
  async bulkDelete(
    @Body() dto: BulkDeleteDealsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.bulkDelete(dto);
  }

  @Put(':id/create-project')
  @Post(':id/create-project')
  async createProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProjectFromDealDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const result = await this.dealsService.createProjectFromDeal(id, dto, req.user.id);
    res.status(201);
    return result;
  }

  @Put(':id/update-value')
  async updateValue(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { value: number | string },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.dealsService.updateValue(id, body);
  }
}
