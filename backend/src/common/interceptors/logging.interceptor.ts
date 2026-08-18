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
    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          this.log(method, originalUrl, response.statusCode, start);
        },
        error: (error: unknown) => {
          const status =
            error instanceof HttpException ? error.getStatus() : 500;
          this.log(method, originalUrl, status, start);
        },
      }),
    );
  }

  private log(method: string, url: string, status: number, start: number) {
    this.logger.log(`${method} ${url} ${status} ${Date.now() - start}ms`);
  }
}
