import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { ProductOption } from '../products/entities/product-option.entity';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartResponse } from './cart.types';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

const CART_TTL_SECONDS = 60 * 60 * 24 * 14;

@Injectable()
export class CartService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(ProductOption)
    private readonly productOptionRepository: Repository<ProductOption>,
  ) {}

  private key(cartId: string): string {
    return `cart:${cartId}`;
  }

  async getCart(cartId: string): Promise<CartResponse> {
    const raw = await this.redis.hgetall(this.key(cartId));
    const entries = Object.entries(raw);

    if (entries.length === 0) {
      return { items: [], totalAmount: 0 };
    }

    const optionIds = entries.map(([productOptionId]) =>
      Number(productOptionId),
    );
    const options = await this.productOptionRepository.find({
      where: { id: In(optionIds) },
      relations: { product: true },
    });
    const optionById = new Map(options.map((option) => [option.id, option]));

    const staleIds = optionIds.filter((id) => !optionById.has(id));
    if (staleIds.length > 0) {
      await this.redis.hdel(
        this.key(cartId),
        ...staleIds.map((id) => String(id)),
      );
    }

    const items = entries
      .map(([productOptionId, quantity]) => {
        const option = optionById.get(Number(productOptionId));
        if (!option) {
          return null;
        }

        const unitPrice = option.product.basePrice;
        const parsedQuantity = Number(quantity);

        return {
          productOptionId: option.id,
          productId: option.product.id,
          productName: option.product.name,
          size: option.size,
          color: option.color,
          unitPrice,
          quantity: parsedQuantity,
          stock: option.stock,
          lineTotal: unitPrice * parsedQuantity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

    return { items, totalAmount };
  }

  async addItem(cartId: string, dto: AddCartItemDto): Promise<CartResponse> {
    const option = await this.productOptionRepository.findOne({
      where: { id: dto.productOptionId },
    });

    if (!option) {
      throw new AppException(
        AppErrors.PRODUCT_OPTION_NOT_FOUND,
        `상품 옵션(id: ${dto.productOptionId})을 찾을 수 없습니다.`,
      );
    }

    const key = this.key(cartId);
    await this.redis.hincrby(key, String(dto.productOptionId), dto.quantity);
    await this.redis.expire(key, CART_TTL_SECONDS);

    return this.getCart(cartId);
  }

  async updateItem(
    cartId: string,
    productOptionId: number,
    dto: UpdateCartItemDto,
  ): Promise<CartResponse> {
    const key = this.key(cartId);
    const exists = await this.redis.hexists(key, String(productOptionId));

    if (!exists) {
      throw new AppException(AppErrors.CART_ITEM_NOT_FOUND);
    }

    await this.redis.hset(key, String(productOptionId), dto.quantity);
    await this.redis.expire(key, CART_TTL_SECONDS);

    return this.getCart(cartId);
  }

  async removeItem(
    cartId: string,
    productOptionId: number,
  ): Promise<CartResponse> {
    const removed = await this.redis.hdel(
      this.key(cartId),
      String(productOptionId),
    );

    if (removed === 0) {
      throw new AppException(AppErrors.CART_ITEM_NOT_FOUND);
    }

    return this.getCart(cartId);
  }
}
