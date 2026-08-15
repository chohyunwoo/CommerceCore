import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // SSE는 EventSource가 헤더를 지원하지 않아 쿼리 파라미터로 토큰을 받음
    const headerToken = request.headers['x-admin-token'] as string | undefined;
    const queryToken = (request.query as Record<string, string>)['token'];
    const token = headerToken ?? queryToken;

    const adminToken = this.configService.get<string>('ADMIN_TOKEN');
    if (!adminToken || token !== adminToken) {
      throw new UnauthorizedException('관리자 인증이 필요합니다.');
    }
    return true;
  }
}
