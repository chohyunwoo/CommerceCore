import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly bucket: string;
  private client: ReturnType<typeof createClient> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>(
      'SUPABASE_STORAGE_BUCKET',
      'product-images',
    );
  }

  static isAllowedMimeType(mimeType: string): boolean {
    return ALLOWED_MIME_TYPES.includes(mimeType);
  }

  /**
   * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY가 없는 환경(CI, 이 기능을 안 쓰는 로컬
   * 개발)에서도 서버가 정상 부팅되도록, 클라이언트는 실제 업로드 시점에만 생성한다.
   * 생성자에서 즉시 만들면 supabase-js가 빈 URL에 바로 예외를 던져 부팅 자체가
   * 죽는다(결정 27의 배포 크래시 루프와 같은 종류의 위험).
   */
  private getClient(): ReturnType<typeof createClient> {
    if (this.client) return this.client;

    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!url || !serviceRoleKey) {
      this.logger.error(
        'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.',
      );
      throw new AppException(AppErrors.IMAGE_UPLOAD_FAILED);
    }

    this.client = createClient(url, serviceRoleKey);
    return this.client;
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    if (!SupabaseStorageService.isAllowedMimeType(file.mimetype)) {
      throw new AppException(AppErrors.INVALID_IMAGE_FILE);
    }

    const client = this.getClient();
    const extension = file.originalname.split('.').pop() ?? 'jpg';
    const path = `products/${Date.now()}-${randomUUID()}.${extension}`;

    const { error } = await client.storage
      .from(this.bucket)
      .upload(path, file.buffer, { contentType: file.mimetype });

    if (error) {
      this.logger.error(`Supabase Storage 업로드 실패: ${error.message}`);
      throw new AppException(AppErrors.IMAGE_UPLOAD_FAILED);
    }

    const { data } = client.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
