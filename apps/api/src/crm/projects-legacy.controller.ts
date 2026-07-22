import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  Optional,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { ProjectTasksService } from './project-tasks.service';
import { StorageService } from '../storage/storage.service';

@Controller('projects')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class ProjectsLegacyController {
  private readonly service: ProjectTasksService;

  constructor(
    prisma: PrismaService,
    @Optional() @Inject(StorageService) storage?: StorageService,
  ) {
    this.service = new ProjectTasksService(prisma, storage);
  }

  @Get('tasks')
  async findAll(@Query() query: any, @Req() req: RequestWithUser, @Res({ passthrough: true }) _res: Response) {
    const result = await this.service.findAll({ ...query, user: req.user });
    return { success: true, ...result };
  }

  @Get('tasks/my-tasks')
  async myTasks(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.getMyTasks(req.user, query);
  }

  @Get('tasks/overdue')
  @Roles('admin', 'manager')
  async overdueTasks(@Req() req: RequestWithUser) {
    return this.service.getOverdueTasks(req.user);
  }

  @Get('tasks/customer-tasks')
  async customerTasks(@Req() req: RequestWithUser, @Query() query: any) {
    return this.service.getCustomerTasks(req.user, query);
  }

  @Get('tasks/assignees')
  @Roles('admin', 'manager', 'employee')
  async assignees(@Res({ passthrough: true }) _res: Response) {
    return this.service.getAssignees();
  }

  @Post('tasks')
  @Roles('admin', 'manager', 'employee')
  @HttpCode(201)
  async createStandaloneTask(@Body() body: any, @Req() req: RequestWithUser) {
    return this.service.createStandaloneTask(body, req.user);
  }

  // Recurring tasks — static routes before generic :id
  @Get('recurring-tasks')
  @Roles('admin', 'manager')
  async getRecurringTasks(@Query() query: any) {
    return this.service.getRecurringTasks(query);
  }

  @Get('recurring-tasks/:id')
  @Roles('admin', 'manager')
  async getRecurringTask(@Param('id', ParseIntPipe) id: number) {
    return this.service.getRecurringTask(id);
  }

  @Post('recurring-tasks')
  @Roles('admin', 'manager')
  @HttpCode(201)
  async createRecurringTask(@Body() body: any, @Req() req: RequestWithUser) {
    return this.service.createRecurringTask(body, req.user);
  }

  @Put('recurring-tasks/:id')
  @Roles('admin', 'manager')
  async updateRecurringTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    return this.service.updateRecurringTask(id, body, req.user);
  }

  @Delete('recurring-tasks/:id')
  @Roles('admin', 'manager')
  async deleteRecurringTask(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.deleteRecurringTask(id, req.user);
  }

  @Patch('recurring-tasks/:id/toggle')
  @Roles('admin', 'manager')
  async toggleRecurringTask(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.toggleRecurringTask(id, req.user);
  }

  // Task-specific sub-routes before generic tasks/:id
  @Patch('tasks/:id/assign')
  @Roles('admin', 'manager')
  async assignTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    return this.service.assignTask(id, body, req.user);
  }

  @Patch('tasks/:id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) _res: Response,
  ) {
    await this.service.getTask(id, req.user);
    const task = await this.service.prisma.project_tasks.update({
      where: { id, deleted_at: null },
      data: {
        status: body.status,
        completed_at: body.status === 'completed' ? new Date() : null,
        actual_hours: body.status === 'completed' ? body.actual_hours ?? 0 : undefined,
      },
      include: this.service.taskInclude,
    });
    return { success: true, data: this.service.mapTask(task) };
  }

  @Post('tasks/:id/log-time')
  async logTime(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    return this.service.logTime(id, body, req.user);
  }

  @Get('tasks/:id/work-log')
  async workLog(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.getWorkLog(id, req.user);
  }

  @Get('tasks/:id/comments')
  async getComments(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.getComments(id, req.user);
  }

  @Post('tasks/:id/comments')
  async addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    return this.service.addComment(id, body, req.user);
  }

  @Delete('tasks/:id/comments/:commentId')
  async deleteComment(
    @Param('id', ParseIntPipe) id: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.service.deleteComment(id, commentId, req.user);
  }

  @Post('tasks/:id/attachments')
  @UseInterceptors(AnyFilesInterceptor())
  async addAttachments(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    return this.service.addAttachments(id, files, body, req.user);
  }

  @Post('tasks/:id/duplicate')
  @Roles('admin', 'manager')
  async duplicateTask(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.duplicateTask(id, req.user);
  }

  @Patch('tasks/:id/additional-assignees')
  @Roles('admin', 'manager')
  async additionalAssignees(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    return this.service.additionalAssignees(id, body, req.user);
  }

  // Microtasks
  @Get('tasks/:id/microtasks')
  async getMicrotasks(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    await this.service.getTask(id, req.user);
    const microtasks = await this.service.prisma.task_microtasks.findMany({
      where: { project_task_id: id },
      include: { profiles: { select: { id: true, first_name: true, last_name: true, avatar: true } } },
      orderBy: { position: 'asc' },
    });
    return { success: true, microtasks };
  }

  @Post('tasks/:id/microtasks')
  async createMicrotask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { title?: string; is_mandatory?: boolean },
    @Req() req: RequestWithUser,
  ) {
    await this.service.getTask(id, req.user);
    if (!body.title?.trim()) throw new BadRequestException('Title is required');
    const maxPos = await this.service.prisma.task_microtasks.aggregate({ _max: { position: true }, where: { project_task_id: id } });
    const microtask = await this.service.prisma.task_microtasks.create({
      data: {
        project_task_id: id,
        title: body.title.trim(),
        position: (maxPos._max.position || 0) + 1,
        is_mandatory: body.is_mandatory !== false,
      },
    });
    return { success: true, microtask };
  }

  @Put('tasks/:id/microtasks/:microtaskId')
  async updateMicrotask(
    @Param('id', ParseIntPipe) id: number,
    @Param('microtaskId', ParseIntPipe) microtaskId: number,
    @Body() body: { title?: string; is_mandatory?: boolean },
    @Req() req: RequestWithUser,
  ) {
    await this.service.getTask(id, req.user);
    const existing = await this.service.prisma.task_microtasks.findUnique({ where: { id: microtaskId } });
    if (!existing || existing.project_task_id !== id) throw new NotFoundException('Microtask not found');
    const updates: any = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.is_mandatory !== undefined) updates.is_mandatory = body.is_mandatory;
    const microtask = await this.service.prisma.task_microtasks.update({
      where: { id: microtaskId },
      data: updates,
    });
    return { success: true, microtask };
  }

  @Put('tasks/:id/microtasks/:microtaskId/toggle')
  async toggleMicrotask(
    @Param('id', ParseIntPipe) id: number,
    @Param('microtaskId', ParseIntPipe) microtaskId: number,
    @Req() req: RequestWithUser,
  ) {
    await this.service.getTask(id, req.user);
    const existing = await this.service.prisma.task_microtasks.findUnique({ where: { id: microtaskId } });
    if (!existing || existing.project_task_id !== id) throw new NotFoundException('Microtask not found');
    const isCompleted = !existing.is_completed;
    const microtask = await this.service.prisma.task_microtasks.update({
      where: { id: microtaskId },
      data: { is_completed: isCompleted, completed_at: isCompleted ? new Date() : null, completed_by: isCompleted ? req.user.id : null },
    });
    return { success: true, microtask };
  }

  @Delete('tasks/:id/microtasks/:microtaskId')
  async deleteMicrotask(
    @Param('id', ParseIntPipe) id: number,
    @Param('microtaskId', ParseIntPipe) microtaskId: number,
    @Req() req: RequestWithUser,
  ) {
    await this.service.getTask(id, req.user);
    const existing = await this.service.prisma.task_microtasks.findUnique({ where: { id: microtaskId } });
    if (!existing || existing.project_task_id !== id) throw new NotFoundException('Microtask not found');
    await this.service.prisma.task_microtasks.delete({ where: { id: microtaskId } });
    return { success: true, message: 'Microtask deleted' };
  }

  // Generic task routes — keep last so specific sub-routes win
  @Get('tasks/:id')
  async getTask(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.getTask(id, req.user);
  }

  @Put('tasks/:id')
  @Roles('admin', 'manager', 'employee')
  async updateTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    return this.service.updateTask(id, body, req.user);
  }

  @Delete('tasks/:id')
  @Roles('admin', 'manager')
  async deleteTask(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.deleteTask(id, req.user);
  }
}
