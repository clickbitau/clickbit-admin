import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { CacheService } from '../redis/cache.service';

export interface StorageUploadResult {
  success: true;
  url: string;
  filename: string;
  key: string;
}

export interface StorageUploadError {
  success: false;
  error: string;
}

export interface StorageUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient;
  private readonly publicBuckets = new Set([
    'portfolio',
    'blog',
    'team',
    'avatars',
    'logos',
    'task-attachments',
  ]);

  constructor(private readonly config: ConfigService,
    private readonly cache?: CacheService) {
    const url = this.config.get<string>('SUPABASE_URL') || '';
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '';
    this.supabase = createClient(url, key);
  }

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('storage', ...parts) ?? `storage:` + parts.filter((p) => p !== undefined && p !== null).join(':');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }


  isConfigured(): boolean {
    return !!(
      this.config.get<string>('SUPABASE_URL') &&
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    );
  }

  async upload(
    fileBuffer: Buffer,
    bucket: string,
    originalname: string,
    mimetype: string,
    folder = '',
    customFilename?: string,
  ): Promise<StorageUploadResult | StorageUploadError> {
    await this.invalidateCache();

    try {
      const filename = customFilename
        ? customFilename
        : this.generateFilename(originalname);
      const key = folder ? `${folder}/${filename}` : filename;

      const { error } = await this.supabase.storage
        .from(bucket)
        .upload(key, fileBuffer, {
          contentType: mimetype || 'application/octet-stream',
          upsert: true,
          cacheControl: '3600',
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const url = await this.resolveUrl(bucket, key);
      return { success: true, url, filename, key };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async delete(bucket: string, key: string): Promise<{ success: boolean; error?: string }> {
    await this.invalidateCache();

    try {
      const { error } = await this.supabase.storage.from(bucket).remove([key]);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async deleteByUrl(
    fileUrl: string,
    allowedBuckets?: string | string[],
  ): Promise<{ success: boolean; deleted: boolean; error?: string }> {
    await this.invalidateCache();

    const parsed = this.parseStorageUrl(fileUrl);
    if (!parsed) return { success: false, deleted: false, error: 'Invalid storage URL' };

    if (allowedBuckets) {
      const allowed = Array.isArray(allowedBuckets) ? allowedBuckets : [allowedBuckets];
      if (!allowed.includes(parsed.bucket)) {
        return {
          success: false,
          deleted: false,
          error: `Unauthorized bucket: ${parsed.bucket}`,
        };
      }
    }

    const result = await this.delete(parsed.bucket, parsed.key);
    return { ...result, deleted: result.success };
  }

  async getSignedUrl(
    bucket: string,
    key: string,
    expiresIn = 3600,
  ): Promise<StorageUrlResult> {
    return this.cached(this.cacheKey('getSignedUrl', bucket, key, expiresIn), async () => {

      try {
        const { data, error } = await this.supabase.storage
          .from(bucket)
          .createSignedUrl(key, expiresIn);
        if (error) return { success: false, error: error.message };
        return { success: true, url: data.signedUrl };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
      }


    });
}

  getPublicUrl(bucket: string, key: string): string {
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(key);
    return data.publicUrl;
  }

  parseStorageUrl(url: string): { bucket: string; key: string } | null {
    try {
      const urlObj = new URL(url);
      const publicMatch = urlObj.pathname.match(
        /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
      );
      if (publicMatch) return { bucket: publicMatch[1], key: publicMatch[2] };

      const signedMatch = urlObj.pathname.match(
        /\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/,
      );
      if (signedMatch) return { bucket: signedMatch[1], key: signedMatch[2] };

      return null;
    } catch {
      return null;
    }
  }

  getTransformedUrl(
    publicUrl: string,
    options: { width?: number; height?: number; quality?: number; resize?: string } = {},
  ): string {
    if (!publicUrl) return publicUrl;
    const { width, height, quality = 80, resize = 'contain' } = options;

    const transformed = publicUrl.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/',
    );

    const params = new URLSearchParams();
    if (width) params.set('width', String(width));
    if (height) params.set('height', String(height));
    if (quality !== 80) params.set('quality', String(quality));
    if (resize !== 'cover') params.set('resize', resize);

    const separator = transformed.includes('?') ? '&' : '?';
    return params.toString() ? `${transformed}${separator}${params.toString()}` : transformed;
  }

  private generateFilename(originalname: string): string {
    const extMatch = originalname.match(/\.[^/.]+$/);
    const ext = extMatch ? extMatch[0] : '';
    const baseName = originalname.replace(ext, '').replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${baseName}-${randomUUID()}${ext}`;
  }

  private async resolveUrl(bucket: string, key: string): Promise<string> {
    if (this.publicBuckets.has(bucket)) {
      return this.getPublicUrl(bucket, key);
    }
    const signed = await this.getSignedUrl(bucket, key);
    if (signed.success && signed.url) return signed.url;
    return this.getPublicUrl(bucket, key);
  }
}
