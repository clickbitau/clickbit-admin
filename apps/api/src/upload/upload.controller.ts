import {
  Controller,
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
}
