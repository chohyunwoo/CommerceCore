import type { Redis } from 'ioredis';

interface SessionData {
  userId: number;
}

/**
 * 세션 토큰으로 로그인 사용자 ID를 조회한다. AuthModule을 의존하지 않고 Redis를
 * 직접 읽어, CartModule↔AuthModule 순환 의존성을 피한다(이슈 #65).
 * 토큰이 없거나 세션이 없으면(비로그인/만료) null을 반환한다 — 에러를 던지지 않는다.
 */
export async function getSessionUserId(
  redis: Redis,
  token: string | undefined,
): Promise<number | null> {
  if (!token) return null;

  const raw = await redis.get(`session:${token}`);
  if (!raw) return null;

  const session = JSON.parse(raw) as SessionData;
  return session.userId;
}
