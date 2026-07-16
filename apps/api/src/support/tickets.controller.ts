import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TicketsService } from './tickets.service';
import {
  BulkUpdateDto,
  CreateTicketDto,
  CustomerTicketListQueryDto,
  MergeTicketsDto,
  ReplyDto,
  StaffTicketListQueryDto,
  TicketListQueryDto,
  TrackFeedbackDto,
  TrackReplyDto,
  UpdateMyAssignedStatusDto,
  UpdateTicketDto,
} from './dto/support.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @UseGuards(OptionalAuthGuard)
  create(@Body() dto: CreateTicketDto, @Req() req: any) {
    return this.ticketsService.create(dto as unknown as Record<string, unknown>, req.user);
  }

  @Get('quota')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('customer')
  getQuota(@Req() req: any) {
    return this.ticketsService.getQuota(req.user);
  }

  @Get('purchase/:sessionId')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  verifyPurchase(@Param('sessionId') sessionId: string) {
    return this.ticketsService.verifyPurchase(sessionId);
  }

  @Post(':id/assign-ai')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('employee', 'manager', 'admin')
  assignAi(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.ticketsService.assignAi(Number(id), dto, req.user);
  }

  @Get('track/:ticketNumber')
  track(@Param('ticketNumber') ticketNumber: string, @Query('email') email?: string) {
    return this.ticketsService.track(ticketNumber, email);
  }

  @Post('track/:ticketNumber/reply')
  trackReply(@Param('ticketNumber') ticketNumber: string, @Body() dto: TrackReplyDto) {
    return this.ticketsService.trackReply(ticketNumber, dto as unknown as Record<string, unknown>);
  }

  @Post('track/:ticketNumber/feedback')
  trackFeedback(@Param('ticketNumber') ticketNumber: string, @Body() dto: TrackFeedbackDto) {
    return this.ticketsService.trackFeedback(ticketNumber, dto as unknown as Record<string, unknown>);
  }

  @Get('my-tickets')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  getMyTickets(@Req() req: any, @Query() query: CustomerTicketListQueryDto) {
    return this.ticketsService.getMyTickets(req.user, query);
  }

  @Get('my-tickets/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  getMyTicketById(@Param('id') id: string, @Req() req: any) {
    return this.ticketsService.getMyTicketById(Number(id), req.user);
  }

  @Post('my-tickets/:id/reply')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  replyToMyTicket(@Param('id') id: string, @Req() req: any, @Body() dto: ReplyDto) {
    return this.ticketsService.replyToMyTicket(Number(id), req.user, dto as unknown as Record<string, unknown>);
  }

  @Post('my-tickets/:id/reopen')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  reopenMyTicket(@Param('id') id: string, @Req() req: any) {
    return this.ticketsService.reopenMyTicket(Number(id), req.user);
  }

  @Get('my-assigned')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  getMyAssigned(@Req() req: any, @Query() query: StaffTicketListQueryDto) {
    return this.ticketsService.getMyAssigned(req.user, query);
  }

  @Get('my-assigned/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  getMyAssignedById(@Param('id') id: string, @Req() req: any) {
    return this.ticketsService.getMyAssignedById(Number(id), req.user);
  }

  @Post('my-assigned/:id/reply')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  replyToMyAssigned(@Param('id') id: string, @Req() req: any, @Body() dto: ReplyDto) {
    return this.ticketsService.replyToMyAssigned(Number(id), req.user, dto as unknown as Record<string, unknown>);
  }

  @Patch('my-assigned/:id/status')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  async updateMyAssignedStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateMyAssignedStatusDto,
  ) {
    return this.ticketsService.updateMyAssignedStatus(Number(id), req.user, dto.status);
  }

  @Post(':id/upload-attachments')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 5))
  uploadAttachments(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) throw new BadRequestException({ message: 'No files provided' });
    return { urls: [] };
  }

  @Get('admin')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  findAllAdmin(@Req() req: any, @Query() query: TicketListQueryDto) {
    return this.ticketsService.findAllAdmin(req.user, query as unknown as Record<string, unknown>);
  }

  @Get('admin/stats')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getStats(@Query('period') period?: string) {
    return this.ticketsService.getStats(Number(period));
  }

  @Get('admin/staff')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getStaff() {
    return this.ticketsService.getStaff();
  }

  @Get('admin/canned-responses')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getCannedResponses() {
    return this.ticketsService.getCannedResponses();
  }

  @Put('admin/canned-responses')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  saveCannedResponses(@Body('responses') responses: unknown[]) {
    return this.ticketsService.saveCannedResponses(responses);
  }

  @Get('admin/export')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async exportCsv(@Query() query: TicketListQueryDto, @Res() res: Response) {
    const { csv, filename } = await this.ticketsService.exportCsv(query as unknown as Record<string, unknown>);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  findOneAdmin(@Param('id') id: string) {
    return this.ticketsService.findOneAdmin(Number(id));
  }

  @Put('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  updateAdmin(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.updateAdmin(Number(id), req.user, dto as unknown as Record<string, unknown>);
  }

  @Post('admin/:id/reply')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  replyAdmin(@Param('id') id: string, @Req() req: any, @Body() dto: ReplyDto) {
    return this.ticketsService.replyAdmin(Number(id), req.user, dto as unknown as Record<string, unknown>);
  }

  @Delete('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.ticketsService.remove(Number(id));
  }

  @Post('admin/bulk-update')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  bulkUpdate(@Req() req: any, @Body() dto: BulkUpdateDto) {
    return this.ticketsService.bulkUpdate(req.user, dto as unknown as Record<string, unknown>);
  }

  @Post('admin/merge')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  merge(@Req() req: any, @Body() dto: MergeTicketsDto) {
    return this.ticketsService.merge(req.user, dto as unknown as Record<string, unknown>);
  }
}