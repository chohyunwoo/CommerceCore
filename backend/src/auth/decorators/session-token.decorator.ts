import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AppErrors } from '../../common/errors/app-errors';
import { AppException } from '../../common/errors/app-exception';

export const SessionToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const token = request.headers['x-session-token'];

    if (!token || Array.isArray(token)) {
      throw new AppException(AppErrors.SESSION_REQUIRED);
    }

    return token;
  },
);
