import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { Request } from 'express';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { AppErrors } from '../errors/app-errors';
import { AppException } from '../errors/app-exception';
import { adminSseTicketKey } from '../session/admin-sse-ticket.util';

/**
 * EventSource가 커스텀 헤더를 지원하지 않아 세션 토큰을 URL에 실을 수밖에 없었던
 * 문제(결정 16 트러블슈팅)를 해소하기 위해, 진짜 세션 토큰 대신 1회용 단기
 * 티켓(POST /admin/events/ticket으로 발급, TTL 30초)만 쿼리 파라미터로 받는다.
 * 검증 즉시 소모(delete)하므로 같은 티켓을 재사용할 수 없다(결정 38).
 */
@Injectable()
export class AdminSseGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawTicket = request.query['ticket'];
    const ticket = typeof rawTicket === 'string' ? rawTicket : undefined;

    if (!ticket) {
      throw new AppException(AppErrors.ADMIN_AUTH_REQUIRED);
    }

    const key = adminSseTicketKey(ticket);
    const deleted = await this.redis.del(key);
    if (deleted === 0) {
      throw new AppException(AppErrors.ADMIN_AUTH_REQUIRED);
    }

    return true;
  }
}
