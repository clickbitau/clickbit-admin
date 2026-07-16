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
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto, UpdateDocumentDto, ShareDocumentDto, ListDocumentsQueryDto } from './dto/documents.dto';
import { setNoCache } from './documents-utils';

@Controller('documents')
@UseGuards(SupabaseAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.documentsService.create(file, req.user, dto as unknown as Record<string, unknown>);
  }

  @Get()
  async findAll(
    @Query() query: ListDocumentsQueryDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.documentsService.findAll(req.user, query as unknown as Record<string, unknown>);
  }

  @Get('entity/:type/:id')
  async findByEntity(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.documentsService.findByEntity(req.user, type, id);
  }

  @Get('stats/summary')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async stats(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.documentsService.stats(req.user);
  }

  @Get(':id/signed-url')
  async signedUrl(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.documentsService.signedUrl(id, req.user);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.documentsService.findOne(id, req.user);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.documentsService.update(id, req.user, dto as unknown as Record<string, unknown>);
  }

  @Post(':id/share')
  async share(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ShareDocumentDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.documentsService.share(id, req.user, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.documentsService.remove(id, req.user);
  }
}
