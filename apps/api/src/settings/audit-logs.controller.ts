import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditLogsService } from './audit-logs.service';

@Controller('admin/audit-logs')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('stats')
  stats(@Query() query: Record<string, unknown>) { return this.auditLogsService.stats(query); }

  @Get()
  findAll(@Query() query: Record<string, unknown>) { return this.auditLogsService.findAll(query); }

  @Get('entity/:type/:id')
  findByEntity(@Param('type') type: string, @Param('id') id: string, @Query() query: Record<string, unknown>) { return this.auditLogsService.findByEntity(type, id, query); }

  @Get('restorable')
  restorable(@Query() query: Record<string, unknown>) { return this.auditLogsService.restorable(query); }

  @Get('entity-types/list')
  entityTypes(@Query() query: Record<string, unknown>) { return this.auditLogsService.stats(query); }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string, @Query() query: Record<string, unknown>) { return this.auditLogsService.findByUser(Number(userId), query); }

  @Get('export')
  @Roles('admin')
  async export(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const csv = await this.auditLogsService.export(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.auditLogsService.findOne(id); }

  @Post(':id/restore')
  @Roles('admin')
  restore(@Param('id') id: string) { return this.auditLogsService.restore(id); }

  @Post(':id/undo')
  @Roles('admin')
  undo(@Param('id') id: string) { return this.auditLogsService.undo(id); }
}
