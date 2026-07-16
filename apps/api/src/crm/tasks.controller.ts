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

@Controller()
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class TasksController {
  private readonly service: ProjectTasksService;

  constructor(
    prisma: PrismaService,
    @Optional() @Inject(StorageService) storage?: StorageService,
  ) {
    this.service = new ProjectTasksService(prisma, storage);
  }

  @Get('tasks')
  async findAll(@Query() query: any, @Res({ passthrough: true }) _res: Response) {
    const result = await this.service.findAll(query);
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

  @Post('projects/:projectId/tasks')
  @Roles('admin', 'manager')
  @HttpCode(201)
  async createProjectTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: any,
    @Req() req: RequestWithUser,
  ) {
    return this.service.createProjectTask(projectId, body, req.user);
  }

  @Get('projects/:projectId/tasks')
  @Roles('admin', 'manager', 'employee')
  async getProjectTasks(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
    @Req() req: RequestWithUser,
  ) {
    return this.service.getProjectTasks(projectId, query, req.user);
  }

  @Get('projects/:projectId/task-activity')
  @Roles('admin', 'manager', 'employee')
  async getProjectActivity(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.service.getProjectActivity(projectId, query);
  }

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
    @Res({ passthrough: true }) _res: Response,
  ) {
    const task = await this.service.prisma.project_tasks.update({
      where: { id },
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
}
