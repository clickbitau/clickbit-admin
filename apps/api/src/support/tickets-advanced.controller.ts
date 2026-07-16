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
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { RequestWithUser } from '../types/request-with-user';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TicketsAdvancedService } from './tickets-advanced.service';

@Controller('tickets')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class TicketsAdvancedController {
  constructor(private readonly service: TicketsAdvancedService) {}

  // Watchers
  @Get(':id/watchers')
  @Roles('admin', 'manager', 'employee')
  async getWatchers(@Param('id', ParseIntPipe) id: number) {
    return this.service.getWatchers(id);
  }

  @Post(':id/watchers')
  @Roles('admin', 'manager', 'employee')
  async addWatcher(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: RequestWithUser) {
    return this.service.addWatcher(id, body, req.user.id);
  }

  @Delete(':id/watchers/:userId')
  @Roles('admin', 'manager', 'employee')
  async removeWatcher(@Param('id', ParseIntPipe) id: number, @Param('userId', ParseIntPipe) userId: number) {
    return this.service.removeWatcher(id, userId);
  }

  @Post(':id/watch')
  @Roles('admin', 'manager', 'employee')
  async watch(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: RequestWithUser) {
    return this.service.watch(id, req.user.id, body);
  }

  // Links
  @Get(':id/links')
  @Roles('admin', 'manager', 'employee')
  async getLinks(@Param('id', ParseIntPipe) id: number) {
    return this.service.getLinks(id);
  }

  @Post(':id/links')
  @Roles('admin', 'manager', 'employee')
  async addLink(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: RequestWithUser) {
    return this.service.addLink(id, body, req.user.id);
  }

  @Delete(':id/links/:linkId')
  @Roles('admin', 'manager', 'employee')
  async removeLink(@Param('id', ParseIntPipe) id: number, @Param('linkId', ParseIntPipe) linkId: number) {
    return this.service.removeLink(id, linkId);
  }

  @Get('link-types')
  linkTypes() {
    return this.service.linkTypes();
  }

  // Audit log
  @Get(':id/audit-log')
  @Roles('admin', 'manager')
  auditLog(@Param('id', ParseIntPipe) id: number, @Query() query: any) {
    return this.service.auditLog(id, query);
  }

  // SLA policies
  @Get('admin/sla-policies')
  @Roles('admin', 'manager')
  async listSlaPolicies() {
    return this.service.listSlaPolicies();
  }

  @Post('admin/sla-policies')
  @Roles('admin', 'manager')
  async createSlaPolicy(@Body() body: any, @Req() req: RequestWithUser) {
    return this.service.createSlaPolicy(body, req.user.id);
  }

  @Put('admin/sla-policies/:id')
  @Roles('admin', 'manager')
  async updateSlaPolicy(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateSlaPolicy(id, body);
  }

  @Delete('admin/sla-policies/:id')
  @Roles('admin', 'manager')
  async deleteSlaPolicy(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteSlaPolicy(id);
  }

  @Get('admin/sla-policies/defaults')
  @Roles('admin', 'manager')
  slaDefaults() {
    return this.service.slaDefaults();
  }

  @Get(':id/sla-status')
  @Roles('admin', 'manager', 'employee')
  async slaStatus(@Param('id', ParseIntPipe) id: number) {
    return this.service.slaStatus(id);
  }

  // Assignment rules
  @Get('admin/assignment-rules')
  @Roles('admin', 'manager')
  listAssignmentRules() {
    return this.service.listAssignmentRules();
  }

  @Post('admin/assignment-rules')
  @Roles('admin', 'manager')
  createAssignmentRule(@Body() body: any, @Req() req: RequestWithUser) {
    return this.service.createAssignmentRule(body, req.user.id);
  }

  @Put('admin/assignment-rules/:id')
  @Roles('admin', 'manager')
  updateAssignmentRule(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateAssignmentRule(id, body);
  }

  @Delete('admin/assignment-rules/:id')
  @Roles('admin', 'manager')
  deleteAssignmentRule(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteAssignmentRule(id);
  }

  @Post('admin/assignment-rules/test')
  @Roles('admin', 'manager')
  testAssignmentRule(@Body() body: any) {
    return this.service.testAssignmentRule(body);
  }

  // Webhooks
  @Get('admin/webhooks')
  @Roles('admin', 'manager')
  async listWebhooks() {
    return this.service.listWebhooks();
  }

  @Get('admin/webhooks/events')
  @Roles('admin', 'manager')
  webhookEvents() {
    return this.service.webhookEvents();
  }

  @Post('admin/webhooks')
  @Roles('admin', 'manager')
  async createWebhook(@Body() body: any, @Req() req: RequestWithUser) {
    return this.service.createWebhook(body, req.user.id);
  }

  @Put('admin/webhooks/:id')
  @Roles('admin', 'manager')
  async updateWebhook(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateWebhook(id, body);
  }

  @Delete('admin/webhooks/:id')
  @Roles('admin', 'manager')
  async deleteWebhook(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteWebhook(id);
  }

  @Post('admin/webhooks/:id/test')
  @Roles('admin', 'manager')
  testWebhook(@Param('id', ParseIntPipe) id: number) {
    return this.service.testWebhook(id);
  }

  @Get('admin/webhooks/:id/logs')
  @Roles('admin', 'manager')
  webhookLogs(@Param('id', ParseIntPipe) id: number, @Query() query: any) {
    return this.service.webhookLogs(id, query);
  }

  // Custom fields
  @Get('admin/custom-fields')
  @Roles('admin', 'manager')
  async listAdminCustomFieldDefinitions(@Query() query: any) {
    return this.service.listCustomFieldDefinitions(query);
  }

  @Get('custom-fields')
  @Roles('admin', 'manager', 'employee')
  async listCustomFieldDefinitions(@Query() query: any) {
    return this.service.listCustomFieldDefinitions(query);
  }

  @Post('admin/custom-fields')
  @Roles('admin', 'manager')
  async createCustomFieldDefinition(@Body() body: any, @Req() req: RequestWithUser) {
    return this.service.createCustomFieldDefinition(body, req.user.id);
  }

  @Put('admin/custom-fields/:id')
  @Roles('admin', 'manager')
  async updateCustomFieldDefinition(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateCustomFieldDefinition(id, body);
  }

  @Delete('admin/custom-fields/:id')
  @Roles('admin', 'manager')
  async deleteCustomFieldDefinition(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteCustomFieldDefinition(id);
  }

  @Get(':id/custom-fields')
  @Roles('admin', 'manager', 'employee')
  async getTicketCustomFields(@Param('id', ParseIntPipe) id: number) {
    return this.service.getTicketCustomFields(id);
  }

  @Put(':id/custom-fields')
  @Roles('admin', 'manager', 'employee')
  async updateTicketCustomFields(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateTicketCustomFields(id, body);
  }

  // Boards
  @Get('admin/boards')
  @Roles('admin', 'manager')
  async listBoards() {
    return this.service.listBoards();
  }

  @Get('admin/boards/:id')
  @Roles('admin', 'manager', 'employee')
  async getBoard(@Param('id', ParseIntPipe) id: number) {
    return this.service.getBoard(id);
  }

  @Post('admin/boards')
  @Roles('admin', 'manager')
  async createBoard(@Body() body: any, @Req() req: RequestWithUser) {
    return this.service.createBoard(body, req.user.id);
  }

  @Put('admin/boards/:id')
  @Roles('admin', 'manager')
  async updateBoard(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateBoard(id, body);
  }

  @Delete('admin/boards/:id')
  @Roles('admin', 'manager')
  async deleteBoard(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteBoard(id);
  }

  @Put('admin/boards/:id/settings')
  @Roles('admin', 'manager')
  async updateBoardSettings(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateBoardSettings(id, body);
  }

  @Put('admin/boards/move-ticket')
  @Roles('admin', 'manager', 'employee')
  async moveTicket(@Body() body: any) {
    return this.service.moveTicket(body);
  }

  @Get('admin/boards/defaults')
  @Roles('admin', 'manager')
  boardDefaults() {
    return this.service.boardDefaults();
  }

  // Components
  @Get('admin/components')
  @Roles('admin', 'manager')
  async listAdminComponents(@Query() query: any) {
    return this.service.listComponents(query);
  }

  @Get('components')
  @Roles('admin', 'manager', 'employee')
  async listComponents(@Query() query: any) {
    return this.service.listComponents(query);
  }

  @Post('admin/components')
  @Roles('admin', 'manager')
  async createComponent(@Body() body: any, @Req() req: RequestWithUser) {
    return this.service.createComponent(body, req.user.id);
  }

  @Put('admin/components/:id')
  @Roles('admin', 'manager')
  async updateComponent(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateComponent(id, body);
  }

  @Delete('admin/components/:id')
  @Roles('admin', 'manager')
  async deleteComponent(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteComponent(id);
  }

  @Get(':id/components')
  @Roles('admin', 'manager', 'employee')
  async getTicketComponents(@Param('id', ParseIntPipe) id: number) {
    return this.service.getTicketComponents(id);
  }

  @Put(':id/components')
  @Roles('admin', 'manager', 'employee')
  async updateTicketComponents(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateTicketComponents(id, body);
  }

  // Time logs
  @Get(':id/time-logs')
  @Roles('admin', 'manager', 'employee')
  async getTimeLogs(@Param('id', ParseIntPipe) id: number, @Query() query: any) {
    return this.service.getTimeLogs(id, query);
  }

  @Get(':id/time-summary')
  @Roles('admin', 'manager', 'employee')
  async timeSummary(@Param('id', ParseIntPipe) id: number) {
    return this.service.timeSummary(id);
  }

  @Post(':id/time-logs')
  @Roles('admin', 'manager', 'employee')
  async createTimeLog(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: RequestWithUser) {
    return this.service.createTimeLog(id, body, req.user.id);
  }

  @Put(':id/time-logs/:logId')
  @Roles('admin', 'manager', 'employee')
  async updateTimeLog(@Param('id', ParseIntPipe) id: number, @Param('logId', ParseIntPipe) logId: number, @Body() body: any) {
    return this.service.updateTimeLog(id, logId, body);
  }

  @Delete(':id/time-logs/:logId')
  @Roles('admin', 'manager', 'employee')
  async deleteTimeLog(@Param('id', ParseIntPipe) id: number, @Param('logId', ParseIntPipe) logId: number) {
    return this.service.deleteTimeLog(id, logId);
  }

  @Put(':id/time-estimate')
  @Roles('admin', 'manager', 'employee')
  async updateTimeEstimate(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateTimeEstimate(id, body);
  }

  @Get('admin/time-report')
  @Roles('admin', 'manager')
  async timeReport(@Query() query: any) {
    return this.service.timeReport(query);
  }

  @Get('my-time-logs')
  @Roles('admin', 'manager', 'employee')
  async myTimeLogs(@Query() query: any, @Req() req: RequestWithUser) {
    return this.service.myTimeLogs(req.user.id, query);
  }

  // Versions
  @Get('admin/versions')
  @Roles('admin', 'manager')
  async listVersions() {
    return this.service.listVersions();
  }

  @Get('admin/versions/:id')
  @Roles('admin', 'manager')
  async getVersion(@Param('id', ParseIntPipe) id: number) {
    return this.service.getVersion(id);
  }

  @Post('admin/versions')
  @Roles('admin', 'manager')
  async createVersion(@Body() body: any, @Req() req: RequestWithUser) {
    return this.service.createVersion(body, req.user.id);
  }

  @Put('admin/versions/:id')
  @Roles('admin', 'manager')
  async updateVersion(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateVersion(id, body);
  }

  @Delete('admin/versions/:id')
  @Roles('admin', 'manager')
  async deleteVersion(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteVersion(id);
  }

  @Post('admin/versions/:id/release')
  @Roles('admin', 'manager')
  async releaseVersion(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.releaseVersion(id, body);
  }

  @Get('admin/versions/:id/release-notes')
  @Roles('admin', 'manager')
  async releaseNotes(@Param('id', ParseIntPipe) id: number) {
    return this.service.releaseNotes(id);
  }

  @Get('versions/unreleased')
  @Roles('admin', 'manager', 'employee')
  async unreleasedVersions() {
    return this.service.unreleasedVersions();
  }

  // Subtasks
  @Get(':id/subtasks')
  @Roles('admin', 'manager', 'employee')
  async getSubtasks(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSubtasks(id);
  }

  @Post(':id/subtasks')
  @Roles('admin', 'manager', 'employee')
  async createSubtask(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.createSubtask(id, body);
  }

  @Put(':id/convert-to-subtask')
  @Roles('admin', 'manager')
  async convertToSubtask(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.convertToSubtask(id, body);
  }

  @Put(':id/convert-to-ticket')
  @Roles('admin', 'manager')
  async convertToTicket(@Param('id', ParseIntPipe) id: number) {
    return this.service.convertToTicket(id);
  }
}
