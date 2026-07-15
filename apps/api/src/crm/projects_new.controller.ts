import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GeneratedCrmService } from './generated-crm.service';

@Controller('crm/projects-new')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class ProjectsNewController {
  constructor(private readonly crm: GeneratedCrmService) {}

  @Get()
  async findAll(
    @Query() query: { page?: string; limit?: string; search?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set('Cache-Control', 'no-store');
    return this.crm.findAll('crm_projects', {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
      search: query.search,
      searchFields: ['name', 'project_number'],
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set('Cache-Control', 'no-store');
    const record = await this.crm.findOne('crm_projects', id);
    if (!record) throw new NotFoundException('project not found');
    return record;
  }

  @Post()
  create(
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set('Cache-Control', 'no-store');
    res.statusCode = 201;
    return this.crm.create('crm_projects', body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set('Cache-Control', 'no-store');
    return this.crm.update('crm_projects', id, body);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set('Cache-Control', 'no-store');
    await this.crm.remove('crm_projects', id);
    return { message: 'project deleted' };
  }
}
