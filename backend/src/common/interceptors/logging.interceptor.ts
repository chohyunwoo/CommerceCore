import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method } = request;
    // 쿼리스트링은 로그에 남기지 않는다 — /orders/lookup?email=(PII),
    // /admin/events?ticket=(SSE 단기 티켓) 등 민감 값이 평문으로 축적되는 것을 방지.
    const path = request.originalUrl.split('?')[0];
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          this.log(method, path, response.statusCode, start);
        },
        error: (error: unknown) => {
          const status =
            error instanceof HttpException ? error.getStatus() : 500;
          this.log(method, path, status, start);
        },
      }),
    );
  }

  private log(method: string, url: string, status: number, start: number) {
    this.logger.log(`${method} ${url} ${status} ${Date.now() - start}ms`);
  }
}
