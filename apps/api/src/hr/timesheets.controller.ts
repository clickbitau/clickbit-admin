import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { TimesheetsService } from './timesheets.service';
import { setNoCache } from './hr-utils';
import { TimesheetQueryDto, TimesheetEditDto, TimesheetRejectDto, WorkItemDto, ManualTimesheetDto, BulkDeleteTimesheetsDto, SummaryQueryDto } from './dto/timesheets.dto';

@Controller('hr/timesheets')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('employee', 'manager', 'admin')
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get()
  async findAll(@Query() query: TimesheetQueryDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.findAll(query, req.user));
  }

  @Get('summary/:employeeId')
  async summary(@Param('employeeId') employeeId: string, @Query() query: SummaryQueryDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.summary(Number(employeeId), query));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.findOne(Number(id), req.user));
  }

  @Put(':id/edit')
  async edit(@Param('id') id: string, @Body() dto: TimesheetEditDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.edit(Number(id), dto, req.user, req));
  }

  @Post(':id/approve')
  @Roles('admin', 'manager')
  async approve(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.approve(Number(id), req.user, req));
  }

  @Post(':id/reject')
  @Roles('admin', 'manager')
  async reject(@Param('id') id: string, @Body() dto: TimesheetRejectDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.reject(Number(id), dto, req.user, req));
  }

  @Get(':id/tasks')
  async tasks(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.tasks(Number(id), req.user));
  }

  @Post(':id/work-items')
  async addWorkItem(@Param('id') id: string, @Body() dto: WorkItemDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.addWorkItem(Number(id), dto, req.user));
  }

  @Delete(':id/work-items/:itemId')
  async removeWorkItem(@Param('id') id: string, @Param('itemId') itemId: string, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.removeWorkItem(Number(id), Number(itemId)));
  }

  @Post('manual')
  async manual(@Body() dto: ManualTimesheetDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    res.status(201);
    return res.json(await this.timesheetsService.manual(dto, req.user, req));
  }

  @Post('bulk-delete')
  @Roles('admin', 'manager')
  async bulkDelete(@Body() dto: BulkDeleteTimesheetsDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.bulkDelete(dto.ids, req.user, req));
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  async remove(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.timesheetsService.remove(Number(id), req.user, req));
  }
}
