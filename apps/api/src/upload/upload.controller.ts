import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  InternalServerErrorException,
  Res,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StorageService } from '../storage/storage.service';
import { UploadService } from './upload.service';
import { UploadImageQueryDto } from './dto/upload.dto';
import { setNoCache } from './upload-utils';

@Controller('upload')
@UseGuards(SupabaseAuthGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly storageService: StorageService,
  ) {}

  @Post('portfolio')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadPortfolio(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: UploadImageQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.uploadService.uploadImage(file, 'portfolio', '', {
      oldImageUrl: query.oldImageUrl,
      allowedBuckets: ['portfolio'],
      transform: { width: 1600, height: 1200, quality: 80, resize: 'contain' },
    });
  }

  @Post('portfolio/multiple')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  async uploadPortfolioMultiple(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.uploadService.uploadMultiple(files, 'portfolio', '', {
      width: 1600,
      height: 1200,
      quality: 80,
      resize: 'contain',
    });
  }

  @Post('blog')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadBlog(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: UploadImageQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.uploadService.uploadImage(file, 'blog', '', {
      oldImageUrl: query.oldImageUrl,
      allowedBuckets: ['blog', 'portfolio'],
      transform: { width: 1920, height: 1080, quality: 80, resize: 'contain' },
    });
  }

  @Post('announcement')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadAnnouncement(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: UploadImageQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.uploadService.uploadImage(file, 'blog', 'announcements', {
      oldImageUrl: query.oldImageUrl,
      allowedBuckets: ['blog'],
      transform: { width: 1200, height: 600, quality: 80, resize: 'contain' },
    });
  }

  @Post('team')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadTeam(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: UploadImageQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.uploadService.uploadImage(file, 'team', '', {
      oldImageUrl: query.oldImageUrl,
      allowedBuckets: ['team', 'avatars'],
      transform: { width: 400, height: 400, quality: 80, resize: 'cover' },
    });
  }

  @Post('company')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadCompany(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: UploadImageQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    return this.uploadService.uploadImage(file, 'portfolio', 'company-logos', {
      oldImageUrl: query.oldImageUrl,
      allowedBuckets: ['portfolio'],
      transform: { width: 400, height: 400, quality: 85, resize: 'contain' },
    });
  }

  @Delete()
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  async deleteByUrl(
    @Body('url') url: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    if (!url) throw new BadRequestException('url is required');
    const result = await this.storageService.deleteByUrl(url);
    if (!result.success) throw new InternalServerErrorException(result.error || 'Delete failed');
    return { success: true, message: 'File deleted successfully' };
  }

  @Post('attachment')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Query('bucket') bucket: string,
    @Query('folder') folder: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    if (!file) throw new BadRequestException('No file uploaded');

    const allowedBuckets = [
      'attachments',
      'task-attachments',
      'ticket-attachments',
      'project-attachments',
      'chat-attachments',
      'documents',
      'hr-documents',
      'finance-documents',
    ];
    const targetBucket = allowedBuckets.includes(bucket) ? bucket : 'attachments';

    const result = await this.storageService.upload(
      file.buffer,
      targetBucket,
      file.originalname,
      file.mimetype,
      folder || '',
    );

    if (!result.success) {
      throw new InternalServerErrorException(result.error || 'Upload failed');
    }

    return {
      message: 'File uploaded successfully',
      url: result.url,
      filename: result.filename,
      key: result.key,
      bucket: targetBucket,
      originalName: file.originalname,
      originalSize: file.size,
      mimetype: file.mimetype,
    };
  }

  @Get('signed-url')
  async getSignedUrl(@Query('url') url: string, @Res({ passthrough: true }) res: Response) {
    setNoCache(res);
    if (!url) throw new BadRequestException('url is required');

    const parsed = this.storageService.parseStorageUrl(url);
    if (!parsed) throw new BadRequestException('Invalid storage URL');

    const signed = await this.storageService.getSignedUrl(parsed.bucket, parsed.key);
    if (!signed.success || !signed.url) {
      throw new InternalServerErrorException(signed.error || 'Failed to refresh signed URL');
    }

    return { url: signed.url };
  }
}
