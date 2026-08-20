import type { ExecutionContext } from '@nestjs/common';
import { AdminSseGuard } from './admin-sse.guard';
import { adminSseTicketKey } from '../session/admin-sse-ticket.util';
import { AppException } from '../errors/app-exception';
import { AppErrors } from '../errors/app-errors';

function createContext(query: Record<string, string>): ExecutionContext {
  const request = { query };
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

describe('AdminSseGuard', () => {
  function createGuard(delCount: number) {
    const redis = { del: jest.fn().mockResolvedValue(delCount) };
    const guard = new AdminSseGuard(redis as never);
    return { guard, redis };
  }

  it('ticket 쿼리 파라미터가 없으면 거부한다', async () => {
    const { guard, redis } = createGuard(1);
    await expectRejectedWithAdminAuthRequired(
      guard.canActivate(createContext({})),
    );
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('존재하지 않거나 이미 소모된 ticket이면 거부한다(재사용 방지)', async () => {
    const { guard, redis } = createGuard(0);
    await expectRejectedWithAdminAuthRequired(
      guard.canActivate(createContext({ ticket: 'used-or-unknown' })),
    );
    expect(redis.del).toHaveBeenCalledWith(
      adminSseTicketKey('used-or-unknown'),
    );
  });

  it('유효한 ticket이면 통과하고 즉시 소모(delete)한다', async () => {
    const { guard, redis } = createGuard(1);
    const context = createContext({ ticket: 'fresh-ticket' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(redis.del).toHaveBeenCalledWith(adminSseTicketKey('fresh-ticket'));
  });
});
