import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Res, Req, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto';
import { setNoCache } from './crm-utils';
import { RequestWithUser } from '../types/request-with-user';

@Controller('crm/projects')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class CrmProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(
    @Query() query: { status?: string; company_id?: string; contact_id?: string; manager_id?: string; search?: string; sort?: string; order?: 'ASC' | 'DESC' | 'asc' | 'desc'; page?: string; limit?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.findAll({
      status: query.status,
      company_id: query.company_id,
      manager_id: query.manager_id,
      contact_id: query.contact_id,
      search: query.search,
      sortBy: query.sort,
      sortOrder: query.order,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Post()
  async create(
    @Body() dto: CreateProjectDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const project = await this.projectsService.create(req.user.id, dto);
    res.status(201);
    return project;
  }

  @Get(':id/related')
  async findRelated(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.findRelated(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string; completion_percentage?: number },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.updateStatus(id, body);
  }
}
