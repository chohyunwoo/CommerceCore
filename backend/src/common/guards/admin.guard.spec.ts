import type { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { UserRole } from '../../auth/entities/user-role.enum';
import { AppException } from '../errors/app-exception';
import { AppErrors } from '../errors/app-errors';

function createContext(
  headers: Record<string, string | string[]>,
): ExecutionContext {
  const request = { headers, user: undefined as unknown };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

async function expectRejectedWithAdminAuthRequired(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  try {
    await promise;
    throw new Error('expected promise to reject');
  } catch (err) {
    const body = (err as AppException).getResponse() as { code: string };
    expect(body.code).toBe(AppErrors.ADMIN_AUTH_REQUIRED.code);
  }
}

describe('AdminGuard', () => {
  function createGuard(
    sessionRaw: string | null,
    user: { id: number; email: string; name: string; role: UserRole } | null,
  ) {
    const redis = { get: jest.fn().mockResolvedValue(sessionRaw) };
    const userRepository = { findOne: jest.fn().mockResolvedValue(user) };
    const guard = new AdminGuard(redis as never, userRepository as never);
    return { guard, redis, userRepository };
  }

  it('X-Session-Token 헤더가 없으면 거부한다', async () => {
    const { guard, userRepository } = createGuard(null, null);
    await expectRejectedWithAdminAuthRequired(
      guard.canActivate(createContext({})),
    );
    expect(userRepository.findOne).not.toHaveBeenCalled();
  });

  it('X-Session-Token 헤더가 중복 전달되어 배열이면(스푸핑 시도) 거부한다', async () => {
    const { guard, userRepository } = createGuard(null, null);
    await expectRejectedWithAdminAuthRequired(
      guard.canActivate(
        createContext({ 'x-session-token': ['token-a', 'token-b'] }),
      ),
    );
    expect(userRepository.findOne).not.toHaveBeenCalled();
  });

  it('세션이 존재하지 않으면(만료/위조) 거부한다', async () => {
    const { guard } = createGuard(null, null);
    await expectRejectedWithAdminAuthRequired(
      guard.canActivate(createContext({ 'x-session-token': 'unknown-token' })),
    );
  });

  it('세션은 유효하지만 role이 admin이 아니면 거부한다', async () => {
    const { guard } = createGuard(JSON.stringify({ userId: 1 }), {
      id: 1,
      email: 'user@example.com',
      name: '일반유저',
      role: UserRole.USER,
    });
    await expectRejectedWithAdminAuthRequired(
      guard.canActivate(createContext({ 'x-session-token': 'valid-token' })),
    );
  });

  it('세션이 유효하고 role이 admin이면 통과하고 request.user를 채운다', async () => {
    const { guard } = createGuard(JSON.stringify({ userId: 7 }), {
      id: 7,
      email: 'admin@example.com',
      name: '관리자',
      role: UserRole.ADMIN,
    });
    const context = createContext({ 'x-session-token': 'valid-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest<{ user: unknown }>().user).toEqual(
      {
        id: 7,
        email: 'admin@example.com',
        name: '관리자',
        role: UserRole.ADMIN,
      },
    );
  });
});
