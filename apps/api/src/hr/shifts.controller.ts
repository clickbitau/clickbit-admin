import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { ShiftsService } from './shifts.service';
import { setNoCache } from './hr-utils';
import { ShiftQueryDto, ShiftCreateDto, ShiftBatchDto, ShiftPublishDto, ShiftCopyWeekDto, OpenShiftQueryDto } from './dto/shifts.dto';

@Controller('hr/shifts')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('employee', 'manager', 'admin')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  async findAll(@Query() query: ShiftQueryDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.shiftsService.findAll(query, req.user));
  }

  @Post()
  @Roles('admin', 'manager')
  async create(@Body() dto: ShiftCreateDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    res.status(201);
    return res.json(await this.shiftsService.create(dto, req.user, req));
  }

  @Post('batch')
  @Roles('admin', 'manager')
  async batch(@Body() dto: ShiftBatchDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    res.status(201);
    return res.json(await this.shiftsService.batch(dto, req.user, req));
  }

  @Put(':id')
  @Roles('admin', 'manager')
  async update(@Param('id') id: string, @Body() dto: ShiftCreateDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.shiftsService.update(Number(id), dto, req.user, req));
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  async remove(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.shiftsService.remove(Number(id), req.user, req));
  }

  @Delete('employee/:employeeId')
  @Roles('admin', 'manager')
  async removeByEmployee(@Param('employeeId') employeeId: string, @Query() query: any, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.shiftsService.removeByEmployee(employeeId, query));
  }

  @Post(':id/confirm')
  async confirm(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.shiftsService.confirm(Number(id), req.user));
  }

  @Post('publish')
  @Roles('admin', 'manager')
  async publish(@Body() dto: ShiftPublishDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.shiftsService.publish(dto, req.user, req));
  }

  @Post('copy-week')
  @Roles('admin', 'manager')
  async copyWeek(@Body() dto: ShiftCopyWeekDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.shiftsService.copyWeek(dto, req.user, req));
  }

  @Get('open')
  async openShifts(@Query() query: OpenShiftQueryDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.shiftsService.openShifts(query));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.shiftsService.findOne(Number(id), req.user));
  }

  @Post(':id/claim')
  async claim(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.shiftsService.claim(Number(id), req.user));
  }
}
