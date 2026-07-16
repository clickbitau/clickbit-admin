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
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { HrFormsService } from './hr-forms.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  ListTemplatesQueryDto,
  CreateSubmissionDto,
  UpdateSubmissionStatusDto,
  ListSubmissionsQueryDto,
} from './dto/hr-forms.dto';

@Controller('hr/forms')
@UseGuards(SupabaseAuthGuard)
export class HrFormsController {
  constructor(private readonly hrFormsService: HrFormsService) {}

  @Get('templates')
  findTemplates(@Query() query: ListTemplatesQueryDto, @Req() req: RequestWithUser) {
    return this.hrFormsService.findTemplates(query as unknown as Record<string, unknown>, req.user);
  }

  @Get('templates/:id')
  findTemplate(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.hrFormsService.findTemplate(id, req.user);
  }

  @Post('templates')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  createTemplate(@Req() req: RequestWithUser, @Body() dto: CreateTemplateDto) {
    return this.hrFormsService.createTemplate(req.user, dto as unknown as Record<string, unknown>);
  }

  @Put('templates/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.hrFormsService.updateTemplate(id, dto as unknown as Record<string, unknown>);
  }

  @Delete('templates/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  removeTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.hrFormsService.removeTemplate(id);
  }

  @Get('submissions')
  findSubmissions(@Query() query: ListSubmissionsQueryDto, @Req() req: RequestWithUser) {
    return this.hrFormsService.findSubmissions(query as unknown as Record<string, unknown>, req.user);
  }

  @Get('submissions/:id')
  findSubmission(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.hrFormsService.findSubmission(id, req.user);
  }

  @Post('submissions')
  createSubmission(@Req() req: RequestWithUser, @Body() dto: CreateSubmissionDto) {
    return this.hrFormsService.createSubmission(req.user, dto as unknown as Record<string, unknown>);
  }

  @Put('submissions/:id/status')
  updateSubmissionStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateSubmissionStatusDto,
  ) {
    return this.hrFormsService.updateSubmissionStatus(id, req.user, dto as unknown as Record<string, unknown>);
  }
}
