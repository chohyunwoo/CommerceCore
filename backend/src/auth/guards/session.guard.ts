import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { AppErrors } from '../../common/errors/app-errors';
import { AppException } from '../../common/errors/app-exception';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers['x-session-token'];

    if (!token || Array.isArray(token)) {
      throw new AppException(AppErrors.SESSION_REQUIRED);
    }

    const session = await this.authService.resolveSession(token);
    request.user = {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
    };
    return true;
  }
}
