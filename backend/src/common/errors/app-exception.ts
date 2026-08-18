import { HttpException } from '@nestjs/common';
import { AppErrorDefinition } from './app-errors';

export class AppException extends HttpException {
  constructor(definition: AppErrorDefinition, message?: string) {
    super(
      {
        statusCode: definition.status,
        message: message ?? definition.message,
        code: definition.code,
      },
      definition.status,
    );
  }
}
