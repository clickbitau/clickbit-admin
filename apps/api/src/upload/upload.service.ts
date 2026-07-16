import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';

export interface SingleUploadResult {
  message: string;
  imageUrl: string;
  transformedUrl: string;
  filename: string;
  originalName: string;
  originalSize: number;
  storage: 'supabase';
}

export interface MultipleUploadResult {
  message: string;
  images: SingleUploadResult[];
}

@Injectable()
export class UploadService {
  constructor(private readonly storage: StorageService) {}

  async uploadImage(
    file: Express.Multer.File,
    bucket: string,
    folder = '',
    options: {
      oldImageUrl?: string;
      allowedBuckets?: string[];
      transform: { width?: number; height?: number; quality?: number; resize?: string };
      customFilename?: string;
    },
  ): Promise<SingleUploadResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!this.storage.isConfigured()) {
      throw new InternalServerErrorException('Supabase storage is not configured');
    }

    if (options.oldImageUrl) {
      await this.storage.deleteByUrl(options.oldImageUrl, options.allowedBuckets ?? [bucket]);
    }

    const result = await this.storage.upload(
      file.buffer,
      bucket,
      file.originalname,
      file.mimetype,
      folder,
      options.customFilename,
    );

    if (!result.success) {
      throw new InternalServerErrorException(result.error || 'Upload failed');
    }

    return {
      message: 'Image uploaded successfully',
      imageUrl: result.url,
      transformedUrl: this.storage.getTransformedUrl(result.url, options.transform),
      filename: result.filename,
      originalName: file.originalname,
      originalSize: file.buffer.length,
      storage: 'supabase',
    };
  }

  async uploadMultiple(
    files: Express.Multer.File[],
    bucket: string,
    folder = '',
    transform: { width?: number; height?: number; quality?: number; resize?: string } = {},
  ): Promise<MultipleUploadResult> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const images = await Promise.all(
      files.map((file) =>
        this.uploadImage(file, bucket, folder, { transform }).catch((error) => ({
          message: error.message || 'Upload failed',
          imageUrl: '',
          transformedUrl: '',
          filename: '',
          originalName: file.originalname,
          originalSize: file.buffer?.length || 0,
          storage: 'supabase' as const,
        })),
      ),
    );

    return { message: 'Images uploaded successfully', images };
  }
}
