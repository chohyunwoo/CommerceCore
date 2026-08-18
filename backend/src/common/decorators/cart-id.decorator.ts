import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AppErrors } from '../errors/app-errors';
import { AppException } from '../errors/app-exception';

export const CartId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const cartId = request.headers['x-cart-id'];

    if (!cartId || Array.isArray(cartId)) {
      throw new AppException(AppErrors.CART_ID_REQUIRED);
    }

    return cartId;
  },
);
