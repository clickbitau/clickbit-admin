import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { BugReportsService } from './bug-reports.service';
import { CreateBugReportDto, UpdateBugReportStatusDto, MarkFixedDto, ListBugReportsQueryDto } from './dto/bug-reports.dto';

@Controller('bug-reports')
@UseGuards(SupabaseAuthGuard)
export class BugReportsController {
  constructor(private readonly bugReportsService: BugReportsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  findAll(@Query() query: ListBugReportsQueryDto) {
    return this.bugReportsService.findAll(query as Record<string, unknown>);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  getStats() {
    return this.bugReportsService.getStats();
  }

  @Get('repos')
  getRepos() {
    return this.bugReportsService.getRepos();
  }

  @Get('config')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getConfig() {
    return this.bugReportsService.getConfig();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.bugReportsService.findOne(req.user, id);
  }

  @Get(':id/pr-details')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  prDetails(@Param('id', ParseIntPipe) id: number) {
    return this.bugReportsService.prDetails(id);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateBugReportDto) {
    return this.bugReportsService.create(req.user, dto);
  }

  @Post(':id/status')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBugReportStatusDto) {
    return this.bugReportsService.updateStatus(id, dto);
  }

  @Post(':id/fixed')
  @UseGuards(RolesGuard)
  @Roles('admin')
  markFixed(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number, @Body() dto: MarkFixedDto) {
    return this.bugReportsService.markFixed(req.user.id, id, dto);
  }

  @Post('sync-all')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  syncAll() {
    return this.bugReportsService.syncAll();
  }

  @Post(':id/sync')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  syncOne(@Param('id', ParseIntPipe) id: number) {
    return this.bugReportsService.syncOne(id);
  }

  @Post(':id/retry')
  @UseGuards(RolesGuard)
  @Roles('admin')
  retry(@Param('id', ParseIntPipe) id: number) {
    return this.bugReportsService.retry(id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  approve(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.bugReportsService.approve(req.user.id, id);
  }

  @Post(':id/force-merge')
  @UseGuards(RolesGuard)
  @Roles('admin')
  forceMerge(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.bugReportsService.forceMerge(req.user.id, id);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('admin')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.bugReportsService.cancel(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bugReportsService.remove(id);
  }
}
