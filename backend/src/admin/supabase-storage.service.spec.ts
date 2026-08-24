import { SupabaseStorageService } from './supabase-storage.service';
import { AppException } from '../common/errors/app-exception';
import { AppErrors } from '../common/errors/app-errors';

const uploadMock = jest.fn();
const getPublicUrlMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      })),
    },
  })),
}));

function createService() {
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const values: Record<string, string> = {
        SUPABASE_URL: 'https://xxxx.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        SUPABASE_STORAGE_BUCKET: 'product-images',
      };
      return values[key] ?? fallback;
    }),
  };
  return new SupabaseStorageService(configService as never);
}

function createServiceWithoutCredentials() {
  const configService = {
    get: jest.fn((_key: string, fallback?: unknown) => fallback),
  };
  return new SupabaseStorageService(configService as never);
}

function buildFile(overrides: Partial<Express.Multer.File> = {}) {
  return {
    originalname: 'shoe.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-bytes'),
    ...overrides,
  } as Express.Multer.File;
}

describe('SupabaseStorageService.uploadImage', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    getPublicUrlMock.mockReset();
  });

  it('SUPABASE_URL/KEY가 없어도 인스턴스화 자체는 실패하지 않는다', () => {
    expect(() => createServiceWithoutCredentials()).not.toThrow();
  });

  it('SUPABASE_URL/KEY가 없으면 업로드 시점에 IMAGE_UPLOAD_FAILED를 던진다', async () => {
    const service = createServiceWithoutCredentials();

    await expect(service.uploadImage(buildFile())).rejects.toBeInstanceOf(
      AppException,
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('허용되지 않는 mime type이면 IMAGE_UPLOAD를 시도하지 않고 INVALID_IMAGE_FILE을 던진다', async () => {
    const service = createService();

    await expect(
      service.uploadImage(buildFile({ mimetype: 'application/pdf' })),
    ).rejects.toBeInstanceOf(AppException);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('업로드 성공 시 public URL을 반환한다', async () => {
    const service = createService();
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: {
        publicUrl:
          'https://xxxx.supabase.co/storage/v1/object/public/product-images/products/abc.jpg',
      },
    });

    const url = await service.uploadImage(buildFile());

    expect(url).toBe(
      'https://xxxx.supabase.co/storage/v1/object/public/product-images/products/abc.jpg',
    );
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it('저장 경로의 확장자는 파일명이 아니라 검증된 MIME 타입에서 정해진다', async () => {
    const service = createService();
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://x/y.png' },
    });

    // originalname에 임의 문자열("php", 확장자 없음 등)을 넣어도 mimetype만 신뢰한다.
    await service.uploadImage(
      buildFile({ originalname: 'evil.php', mimetype: 'image/png' }),
    );

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^products\/[^/]+\.png$/),
      expect.anything(),
      expect.objectContaining({
        contentType: 'image/png',
        cacheControl: '31536000',
      }),
    );
  });

  it('Supabase가 에러를 반환하면 IMAGE_UPLOAD_FAILED를 던진다', async () => {
    const service = createService();
    uploadMock.mockResolvedValue({ error: { message: 'bucket not found' } });

    await expect(service.uploadImage(buildFile())).rejects.toBeInstanceOf(
      AppException,
    );
    try {
      await service.uploadImage(buildFile());
    } catch (err) {
      const body = (err as AppException).getResponse() as { code: string };
      expect(body.code).toBe(AppErrors.IMAGE_UPLOAD_FAILED.code);
    }
  });
});
