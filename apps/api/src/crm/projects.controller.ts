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
  Req,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateProjectTaskDto,
  CreateSubprojectDto,
  UpdateSubprojectDto,
  CreateMeetingDto,
  UpdateMeetingDto,
  ProjectStatusDto,
  SendSupportEmailDto,
} from './dto';
import { setNoCache } from './crm-utils';
import { RequestWithUser } from '../types/request-with-user';

@Controller('crm/projects-new')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(
    @Query() query: { status?: string; search?: string; company_id?: string; manager_id?: string; page?: string; limit?: string; sortBy?: string; sortOrder?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.findAll({
      ...query,
      page: Number(query.page || 1),
      limit: Number(query.limit || 50),
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

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.delete(id);
  }

  @Get(':id/related')
  async getRelated(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.getRelated(id);
  }

  @Get(':id/tasks')
  async getTasks(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.getTasks(id, Number(page || 1), Number(limit || 50));
  }

  @Post(':id/tasks')
  async createTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProjectTaskDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.createTask(id, dto, req.user.id);
  }

  @Get(':id/subprojects')
  async getSubprojects(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.getSubprojects(id, Number(page || 1), Number(limit || 50));
  }

  @Post(':id/subprojects')
  async createSubproject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSubprojectDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.createSubproject(id, dto, req.user.id);
  }

  @Get(':id/subprojects/:subprojectId')
  async findSubproject(
    @Param('subprojectId', ParseIntPipe) subprojectId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return { data: await this.projectsService.getSubproject(subprojectId) };
  }

  @Put(':id/subprojects/:subprojectId')
  async updateSubproject(
    @Param('subprojectId', ParseIntPipe) subprojectId: number,
    @Body() dto: UpdateSubprojectDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.updateSubproject(subprojectId, dto);
  }

  @Delete(':id/subprojects/:subprojectId')
  @Roles('admin')
  async deleteSubproject(
    @Param('subprojectId', ParseIntPipe) subprojectId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.deleteSubproject(subprojectId);
  }

  @Get(':id/documents')
  async getDocuments(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.getDocuments(id, Number(page || 1), Number(limit || 50));
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('document'))
  async uploadDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.uploadDocument(id, file, req.user.id);
  }

  @Delete(':id/documents/:documentId')
  async deleteDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.deleteDocument(id, documentId);
  }

  @Get(':id/meetings')
  async getMeetings(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.getMeetings(id, Number(page || 1), Number(limit || 50));
  }

  @Post(':id/meetings')
  async createMeeting(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMeetingDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.createMeeting(id, dto, req.user.id);
  }

  @Get(':id/meetings/:meetingId')
  async getMeeting(
    @Param('id', ParseIntPipe) id: number,
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return { data: await this.projectsService.getMeeting(meetingId) };
  }

  @Put(':id/meetings/:meetingId')
  async updateMeeting(
    @Param('id', ParseIntPipe) id: number,
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Body() dto: UpdateMeetingDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.updateMeeting(id, meetingId, dto);
  }

  @Delete(':id/meetings/:meetingId')
  async deleteMeeting(
    @Param('id', ParseIntPipe) id: number,
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.deleteMeeting(id, meetingId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProjectStatusDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.updateStatus(id, { status: dto.status });
  }

  @Post(':id/recalculate-progress')
  async recalculateProgress(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.recalculateProgress(id);
  }

  @Post(':id/send-support-email')
  async sendSupportEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendSupportEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.sendSupportEmail(id, dto);
  }

  @Post(':id/subprojects/:subprojectId/send-support-email')
  async sendSubprojectSupportEmail(
    @Param('id', ParseIntPipe) id: number,
    @Param('subprojectId', ParseIntPipe) subprojectId: number,
    @Body() dto: SendSupportEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.sendSubprojectSupportEmail(id, subprojectId, dto);
  }

  @Get(':id/subprojects/:subprojectId/documents')
  async getSubprojectDocuments(
    @Param('subprojectId', ParseIntPipe) subprojectId: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.getSubprojectDocuments(subprojectId, Number(page || 1), Number(limit || 50));
  }

  @Post(':id/subprojects/:subprojectId/documents')
  @UseInterceptors(FileInterceptor('document'))
  async uploadSubprojectDocument(
    @Param('subprojectId', ParseIntPipe) subprojectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.uploadSubprojectDocument(subprojectId, file, req.user.id);
  }

  @Delete(':id/subprojects/:subprojectId/documents/:documentId')
  async deleteSubprojectDocument(
    @Param('subprojectId', ParseIntPipe) subprojectId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.deleteSubprojectDocument(subprojectId, documentId);
  }

  @Get(':id/subprojects/:subprojectId/meetings')
  async getSubprojectMeetings(
    @Param('subprojectId', ParseIntPipe) subprojectId: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.getSubprojectMeetings(subprojectId, Number(page || 1), Number(limit || 50));
  }

  @Put(':id/subprojects/:subprojectId/support')
  async updateSubprojectSupport(
    @Param('subprojectId', ParseIntPipe) subprojectId: number,
    @Body() dto: UpdateSubprojectDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.projectsService.updateSubprojectSupport(subprojectId, dto);
  }
}
