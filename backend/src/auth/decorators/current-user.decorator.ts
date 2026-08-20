import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser as CurrentUserData } from '../auth.types';

/** SessionGuard가 이미 request.user를 채워둔 뒤에만 사용한다. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user!;
  },
);
