import { Controller, Get, Post, Put, Delete, Param, Body, Query, Res, ParseIntPipe, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PdfTemplatesService } from './pdf-templates.service';

@Controller('settings/pdf-templates')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class PdfTemplatesController {
  constructor(private readonly pdfTemplatesService: PdfTemplatesService) {}

  @Get()
  async findAll(@Query('type') type?: string) {
    return this.pdfTemplatesService.findAll(type);
  }

  @Get('default/:type')
  async getDefault(@Param('type') type: string) {
    return this.pdfTemplatesService.getDefaultTemplate(type);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pdfTemplatesService.findOne(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.pdfTemplatesService.create(body || {});
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.pdfTemplatesService.update(id, body || {});
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.pdfTemplatesService.remove(id);
  }

  @Post(':id/set-default')
  @Put(':id/set-default')
  async setDefault(@Param('id', ParseIntPipe) id: number) {
    return this.pdfTemplatesService.setDefault(id);
  }

  @Post(':id/clone')
  async clone(@Param('id', ParseIntPipe) id: number) {
    return this.pdfTemplatesService.clone(id);
  }

  @Post(':id/preview')
  async preview(@Param('id', ParseIntPipe) id: number) {
    return this.pdfTemplatesService.preview(id);
  }

  @Post('preview')
  previewWithData(@Body() body: any) {
    return this.pdfTemplatesService.previewWithData(body || {});
  }

  @Post(':id/preview-pdf')
  async previewPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { buffer } = await this.pdfTemplatesService.previewPdf(id);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="preview.pdf"');
    res.send(buffer);
  }

  @Post('preview-pdf')
  async previewPdfWithData(@Body() body: any, @Res() res: Response) {
    const { buffer } = await this.pdfTemplatesService.previewPdfWithData(body || {});
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="preview.pdf"');
    res.send(buffer);
  }

  @Post('seed')
  seed() {
    return this.pdfTemplatesService.seedDefaults();
  }
}
