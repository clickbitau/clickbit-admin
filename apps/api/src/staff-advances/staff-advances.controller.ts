import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { StaffAdvancesService } from './staff-advances.service';
import { CreateAdvanceDto, UpdateAdvanceDto, RejectAdvanceDto, CreateDeductionDto, RequestAdvanceDto, ListAdvancesQueryDto } from './dto/staff-advances.dto';

@Controller('staff-advances')
@UseGuards(SupabaseAuthGuard)
export class StaffAdvancesController {
  constructor(private readonly staffAdvancesService: StaffAdvancesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  findAll(@Query() query: ListAdvancesQueryDto) {
    return this.staffAdvancesService.findAll(query as unknown as Record<string, unknown>);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  create(@Req() req: RequestWithUser, @Body() dto: CreateAdvanceDto) {
    return this.staffAdvancesService.create(req.user.id, dto);
  }

  @Get('me')
  findMe(@Req() req: RequestWithUser) {
    return this.staffAdvancesService.findMe(req.user.id);
  }

  @Get('me/eligible')
  checkEligibility(@Req() req: RequestWithUser) {
    return this.staffAdvancesService.checkEligibility(req.user.id);
  }

  @Post('me/request')
  request(@Req() req: RequestWithUser, @Body() dto: RequestAdvanceDto) {
    return this.staffAdvancesService.request(req.user.id, dto);
  }

  @Get(':id')
  findOne(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.staffAdvancesService.findOne(req.user, id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdvanceDto) {
    return this.staffAdvancesService.update(id, dto);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  approve(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.staffAdvancesService.approve(req.user.id, id);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectAdvanceDto) {
    return this.staffAdvancesService.reject(0, id, dto.reason);
  }

  @Post(':id/deductions')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  addDeduction(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateDeductionDto) {
    return this.staffAdvancesService.addDeduction(req.user.id, id, dto);
  }

  @Delete(':id/deductions/:deductionId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  removeDeduction(@Param('id', ParseIntPipe) id: number, @Param('deductionId', ParseIntPipe) deductionId: number) {
    return this.staffAdvancesService.removeDeduction(id, deductionId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.staffAdvancesService.remove(id);
  }
}
