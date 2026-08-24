import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

// compare만 실제 구현을 감싼 jest.fn으로 대체 — 동작(해시 비교)은 그대로 두고 호출만 관찰한다.
// (bcryptjs의 export는 non-configurable이라 jest.spyOn이 불가능해 모듈 목으로 처리)
jest.mock('bcryptjs', () => {
  const actual = jest.requireActual<typeof import('bcryptjs')>('bcryptjs');
  return {
    ...actual,
    // 2-인자 화살표로 감싸 Promise 오버로드를 명확히 선택(콜백 오버로드 회피).
    compare: jest.fn((data: string, encrypted: string) =>
      actual.compare(data, encrypted),
    ),
  };
});
import { User } from './entities/user.entity';
import { AppException } from '../common/errors/app-exception';
import { AppErrors, AppErrorDefinition } from '../common/errors/app-errors';

async function expectAppError(
  promise: Promise<unknown>,
  def: AppErrorDefinition,
) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  try {
    await promise;
    throw new Error('expected promise to reject');
  } catch (err) {
    const body = (err as AppException).getResponse() as {
      code: string;
      statusCode: number;
    };
    expect(body.code).toBe(def.code);
    expect(body.statusCode).toBe(def.status);
  }
}

function createAuthService(existingUser: Partial<User> | null) {
  const userRepository = {
    findOne: jest.fn().mockResolvedValue(existingUser),
    create: jest.fn((data: Partial<User>) => ({ ...data })),
    save: jest.fn((data: Partial<User>) => Promise.resolve({ id: 1, ...data })),
  };
  const redis = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
  const cartService = {
    mergeGuestCartIntoUser: jest.fn().mockResolvedValue(undefined),
  };

  const service = new AuthService(
    userRepository as never,
    redis as never,
    cartService as never,
  );

  return { service, userRepository, redis, cartService };
}

describe('AuthService.register', () => {
  it('이미 가입된 이메일이면 EMAIL_ALREADY_EXISTS를 던진다', async () => {
    const { service } = createAuthService({ id: 1, email: 'a@b.com' });

    await expectAppError(
      service.register({
        email: 'a@b.com',
        password: 'password1234',
        name: '홍길동',
      }),
      AppErrors.EMAIL_ALREADY_EXISTS,
    );
  });

  it('정상 가입 시 비밀번호를 해싱해 저장하고 세션을 발급한다', async () => {
    const { service, userRepository, redis } = createAuthService(null);

    const result = await service.register({
      email: 'a@b.com',
      password: 'password1234',
      name: '홍길동',
    });

    expect(result.user).toEqual({ id: 1, email: 'a@b.com', name: '홍길동' });
    expect(result.token).toBeTruthy();

    const savedArg = userRepository.save.mock.calls[0][0] as {
      passwordHash: string;
    };
    expect(savedArg.passwordHash).not.toBe('password1234');
    expect(await bcrypt.compare('password1234', savedArg.passwordHash)).toBe(
      true,
    );

    expect(redis.set).toHaveBeenCalledWith(
      `session:${result.token}`,
      JSON.stringify({ userId: 1, email: 'a@b.com', name: '홍길동' }),
      'EX',
      60 * 60 * 24 * 14,
    );
  });

  it('cartId가 있으면 게스트 장바구니를 병합한다', async () => {
    const { service, cartService } = createAuthService(null);

    const result = await service.register(
      { email: 'a@b.com', password: 'password1234', name: '홍길동' },
      'guest-cart-1',
    );

    expect(cartService.mergeGuestCartIntoUser).toHaveBeenCalledWith(
      'guest-cart-1',
      result.user.id,
    );
  });

  it('cartId가 없으면 장바구니 병합을 시도하지 않는다', async () => {
    const { service, cartService } = createAuthService(null);

    await service.register({
      email: 'a@b.com',
      password: 'password1234',
      name: '홍길동',
    });

    expect(cartService.mergeGuestCartIntoUser).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  it('존재하지 않는 이메일이면 INVALID_CREDENTIALS를 던진다', async () => {
    const { service } = createAuthService(null);

    await expectAppError(
      service.login({ email: 'a@b.com', password: 'password1234' }),
      AppErrors.INVALID_CREDENTIALS,
    );
  });

  it('존재하지 않는 이메일이어도 bcrypt.compare를 수행해 타이밍을 균일화한다', async () => {
    const { service } = createAuthService(null);
    (bcrypt.compare as jest.Mock).mockClear();

    await expectAppError(
      service.login({ email: 'nobody@b.com', password: 'password1234' }),
      AppErrors.INVALID_CREDENTIALS,
    );

    // 미존재 계정에서도 compare가 호출되어야 존재 계정과 응답 시간이 구분되지 않는다.
    expect(bcrypt.compare as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('비밀번호가 틀리면 INVALID_CREDENTIALS를 던진다', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const { service } = createAuthService({
      id: 1,
      email: 'a@b.com',
      passwordHash,
      name: '홍길동',
    });

    await expectAppError(
      service.login({ email: 'a@b.com', password: 'wrong-password' }),
      AppErrors.INVALID_CREDENTIALS,
    );
  });

  it('정상 로그인이면 세션을 발급한다', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const { service, redis } = createAuthService({
      id: 1,
      email: 'a@b.com',
      passwordHash,
      name: '홍길동',
    });

    const result = await service.login({
      email: 'a@b.com',
      password: 'correct-password',
    });

    expect(result.user).toEqual({ id: 1, email: 'a@b.com', name: '홍길동' });
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  it('cartId가 있으면 게스트 장바구니를 병합한다', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const { service, cartService } = createAuthService({
      id: 1,
      email: 'a@b.com',
      passwordHash,
      name: '홍길동',
    });

    await service.login(
      { email: 'a@b.com', password: 'correct-password' },
      'guest-cart-1',
    );

    expect(cartService.mergeGuestCartIntoUser).toHaveBeenCalledWith(
      'guest-cart-1',
      1,
    );
  });
});

describe('AuthService.logout', () => {
  it('세션 키를 삭제한다', async () => {
    const { service, redis } = createAuthService(null);

    await service.logout('some-token');

    expect(redis.del).toHaveBeenCalledWith('session:some-token');
  });
});

describe('AuthService.getCurrentUser / resolveSession', () => {
  it('세션이 없으면 SESSION_REQUIRED를 던진다', async () => {
    const { service, redis } = createAuthService(null);
    redis.get.mockResolvedValue(null);

    await expectAppError(
      service.getCurrentUser('missing-token'),
      AppErrors.SESSION_REQUIRED,
    );
  });

  it('세션이 있으면 사용자 정보를 반환한다', async () => {
    const { service, redis } = createAuthService(null);
    redis.get.mockResolvedValue(
      JSON.stringify({ userId: 1, email: 'a@b.com', name: '홍길동' }),
    );

    const result = await service.getCurrentUser('valid-token');

    expect(result).toEqual({ id: 1, email: 'a@b.com', name: '홍길동' });
  });
});
