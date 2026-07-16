import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { ProjectLifecycleService } from './project-lifecycle.service';

@Controller('project-lifecycle')
@UseGuards(SupabaseAuthGuard)
export class ProjectLifecycleController {
  constructor(private readonly service: ProjectLifecycleService) {}

  // Templates
  @Get('templates')
  async getTemplates(@Query('project_type') projectType?: string) {
    const templates = await this.service.getTemplates(projectType);
    return { success: true, templates };
  }

  @Get('templates/:id')
  async getTemplate(@Param('id', ParseIntPipe) id: number) {
    const template = await this.service.getTemplate(id);
    return { success: true, template };
  }

  @Post('templates/:id/preview')
  async previewTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { startDate: string; endDate: string },
  ) {
    const preview = await this.service.previewTemplate(id, body.startDate, body.endDate);
    return { success: true, preview };
  }

  // Apply template
  @Post('projects/:id/apply-template')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async applyTemplateToProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { templateId: number },
    @Req() req: RequestWithUser,
  ) {
    const result = await this.service.applyTemplate(id, 'project', Number(body.templateId), req.user);
    return { success: true, ...result };
  }

  @Post('subprojects/:id/apply-template')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async applyTemplateToSubproject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { templateId: number },
    @Req() req: RequestWithUser,
  ) {
    const result = await this.service.applyTemplate(id, 'subproject', Number(body.templateId), req.user);
    return { success: true, ...result };
  }

  // Reset phases
  @Delete('subprojects/:id/phases')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async resetSubprojectPhases(@Param('id', ParseIntPipe) id: number) {
    return this.service.resetPhases(id, 'subproject');
  }

  @Delete('projects/:id/phases')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async resetProjectPhases(@Param('id', ParseIntPipe) id: number) {
    return this.service.resetPhases(id, 'project');
  }

  // List phases
  @Get('projects/:id/phases')
  async getProjectPhases(@Param('id', ParseIntPipe) id: number) {
    const phases = await this.service.getPhases(id, 'project');
    return { success: true, phases };
  }

  @Get('subprojects/:id/phases')
  async getSubprojectPhases(@Param('id', ParseIntPipe) id: number) {
    const phases = await this.service.getPhases(id, 'subproject');
    return { success: true, phases };
  }

  // Create phase
  @Post('projects/:id/phases')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @HttpCode(201)
  async createProjectPhase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    const phase = await this.service.createPhase(id, 'project', body, req.user);
    return { success: true, phase };
  }

  @Post('subprojects/:id/phases')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @HttpCode(201)
  async createSubprojectPhase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    const phase = await this.service.createPhase(id, 'subproject', body, req.user);
    return { success: true, phase };
  }

  // Update / delete phase
  @Put('phases/:phaseId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async updatePhase(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    const phase = await this.service.updatePhase(phaseId, body, req.user);
    return { success: true, phase };
  }

  @Put('projects/:id/phases/reorder')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async reorderProjectPhases(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { phases?: any[] },
    @Req() req: RequestWithUser,
  ) {
    const phases = await this.service.reorderPhases(id, 'project', body.phases || [], req.user);
    return { success: true, phases };
  }

  @Delete('phases/:phaseId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async deletePhase(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.service.deletePhase(phaseId);
  }

  // Phase logs
  @Get('phases/:phaseId/log')
  async getPhaseLogs(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Query('limit') limit?: string,
  ) {
    const logs = await this.service.getPhaseLogs(phaseId, limit ? Number(limit) : 50);
    return { success: true, logs };
  }

  // Tasks in phases
  @Post('phases/:phaseId/tasks')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @HttpCode(201)
  async createTaskInPhase(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    const task = await this.service.createTaskInPhase(phaseId, body, req.user);
    return { success: true, task };
  }

  @Delete('phases/:phaseId/tasks/:taskId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async deleteTaskFromPhase(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.service.deleteTaskFromPhase(phaseId, taskId);
  }

  // Microtasks
  @Get('tasks/:taskId/microtasks')
  async getMicrotasks(@Param('taskId', ParseIntPipe) taskId: number) {
    const result = await this.service.getMicrotasks(taskId);
    return { success: true, ...result };
  }

  @Post('tasks/:taskId/microtasks')
  @HttpCode(201)
  async createMicrotask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    const microtask = await this.service.createMicrotask(taskId, body, req.user);
    return { success: true, microtask };
  }

  @Put('tasks/:taskId/microtasks/:id')
  async updateMicrotask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    const microtask = await this.service.updateMicrotask(taskId, id, body);
    return { success: true, microtask };
  }

  @Put('tasks/:taskId/microtasks/:id/toggle')
  async toggleMicrotask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    const result = await this.service.toggleMicrotask(taskId, id, req.user);
    return { success: true, ...result };
  }

  @Delete('tasks/:taskId/microtasks/:id')
  async deleteMicrotask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteMicrotask(taskId, id);
  }

  @Put('tasks/:taskId/microtasks/reorder')
  async reorderMicrotasks(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: { microtasks?: any[] },
  ) {
    return this.service.reorderMicrotasks(taskId, body.microtasks || []);
  }

  @Put('tasks/:taskId/microtasks/toggle-all')
  async toggleAllMicrotasks(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: { completed?: boolean },
    @Req() req: RequestWithUser,
  ) {
    return this.service.toggleAllMicrotasks(taskId, body.completed ?? true, req.user);
  }

  // Timeline
  @Put('projects/:id/recalculate-timeline')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async recalculateProjectTimeline(@Param('id', ParseIntPipe) id: number) {
    return this.service.recalculateTimeline(id, 'project');
  }

  @Put('subprojects/:id/recalculate-timeline')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async recalculateSubprojectTimeline(@Param('id', ParseIntPipe) id: number) {
    return this.service.recalculateTimeline(id, 'subproject');
  }

  @Get('projects/:id/expected-completion')
  async getProjectExpectedCompletion(@Param('id', ParseIntPipe) id: number) {
    const result = await this.service.getExpectedCompletion(id, 'project');
    return { success: true, ...result };
  }

  @Get('subprojects/:id/expected-completion')
  async getSubprojectExpectedCompletion(@Param('id', ParseIntPipe) id: number) {
    const result = await this.service.getExpectedCompletion(id, 'subproject');
    return { success: true, ...result };
  }

  @Get('phases/:phaseId/expected-completion')
  async getPhaseExpectedCompletion(@Param('phaseId', ParseIntPipe) phaseId: number) {
    const result = await this.service.getExpectedCompletion(phaseId, 'phase');
    return { success: true, ...result };
  }
}
