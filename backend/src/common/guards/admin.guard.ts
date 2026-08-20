import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Redis } from 'ioredis';
import { Request } from 'express';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { getSessionUserId } from '../session/session.util';
import { User } from '../../auth/entities/user.entity';
import { UserRole } from '../../auth/entities/user-role.enum';
import { AppErrors } from '../errors/app-errors';
import { AppException } from '../errors/app-exception';

/**
 * 정적 공유 토큰(결정 16) 대신 로그인 세션 + role을 확인한다(결정 38).
 * role은 세션에 캐싱하지 않고 매 요청 DB에서 조회 — 권한 회수가 재로그인
 * 없이 즉시 반영되도록 하기 위함(관리자 API는 트래픽이 적어 조회 비용 무시 가능).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers['x-session-token'] as string | undefined;

    const userId = await getSessionUserId(this.redis, token);
    if (!userId) {
      throw new AppException(AppErrors.ADMIN_AUTH_REQUIRED);
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.role !== UserRole.ADMIN) {
      throw new AppException(AppErrors.ADMIN_AUTH_REQUIRED);
    }

    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    return true;
  }
}
