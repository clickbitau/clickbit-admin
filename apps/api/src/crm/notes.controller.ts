import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  Res,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto';
import { setNoCache } from './crm-utils';
import { RequestWithUser } from '../types/request-with-user';

@Controller('crm/notes')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  async findAll(
    @Query() query: { contact_id?: string; company_id?: string; deal_id?: string; activity_id?: string; note_type?: string; page?: string; limit?: string; sortBy?: string; sortOrder?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notesService.findAll({
      ...query,
      contact_id: query.contact_id ? Number(query.contact_id) : undefined,
      company_id: query.company_id ? Number(query.company_id) : undefined,
      deal_id: query.deal_id ? Number(query.deal_id) : undefined,
      activity_id: query.activity_id ? Number(query.activity_id) : undefined,
      page: Number(query.page || 1),
      limit: Number(query.limit || 50),
    });
  }

  @Post()
  async create(
    @Body() dto: CreateNoteDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const note = await this.notesService.create(req.user.id, dto);
    res.status(201);
    return note;
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notesService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNoteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.notesService.delete(id);
  }
}
