import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';

export const CartId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const cartId = request.headers['x-cart-id'];

    if (!cartId || Array.isArray(cartId)) {
      throw new BadRequestException('X-Cart-Id 헤더가 필요합니다.');
    }

    return cartId;
  },
);
