import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { ProductOption } from '../products/entities/product-option.entity';
import { CartItem } from './entities/cart-item.entity';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartResponse } from './cart.types';
import { getSessionUserId } from '../common/session/session.util';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

const CART_TTL_SECONDS = 60 * 60 * 24 * 14;

@Injectable()
export class CartService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(ProductOption)
    private readonly productOptionRepository: Repository<ProductOption>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
  ) {}

  private key(cartId: string): string {
    return `cart:${cartId}`;
  }

  async getCart(cartId: string, sessionToken?: string): Promise<CartResponse> {
    const userId = await getSessionUserId(this.redis, sessionToken);
    const quantityByOptionId = userId
      ? await this.getDbQuantities(userId)
      : await this.getRedisQuantities(cartId);

    const { response, staleIds } = await this.buildResponse(quantityByOptionId);

    if (staleIds.length > 0) {
      if (userId) {
        await this.cartItemRepository.delete({
          userId,
          productOptionId: In(staleIds),
        });
      } else {
        await this.redis.hdel(this.key(cartId), ...staleIds.map(String));
      }
    }

    return response;
  }

  async addItem(
    cartId: string,
    dto: AddCartItemDto,
    sessionToken?: string,
  ): Promise<CartResponse> {
    const option = await this.productOptionRepository.findOne({
      where: { id: dto.productOptionId },
    });

    if (!option) {
      throw new AppException(
        AppErrors.PRODUCT_OPTION_NOT_FOUND,
        `상품 옵션(id: ${dto.productOptionId})을 찾을 수 없습니다.`,
      );
    }

    const userId = await getSessionUserId(this.redis, sessionToken);
    if (userId) {
      await this.upsertDbItem(userId, dto.productOptionId, dto.quantity);
    } else {
      const key = this.key(cartId);
      await this.redis.hincrby(key, String(dto.productOptionId), dto.quantity);
      await this.redis.expire(key, CART_TTL_SECONDS);
    }

    return this.getCart(cartId, sessionToken);
  }

  async updateItem(
    cartId: string,
    productOptionId: number,
    dto: UpdateCartItemDto,
    sessionToken?: string,
  ): Promise<CartResponse> {
    const userId = await getSessionUserId(this.redis, sessionToken);

    if (userId) {
      const result = await this.cartItemRepository.update(
        { userId, productOptionId },
        { quantity: dto.quantity },
      );
      if (result.affected === 0) {
        throw new AppException(AppErrors.CART_ITEM_NOT_FOUND);
      }
    } else {
      const key = this.key(cartId);
      const exists = await this.redis.hexists(key, String(productOptionId));
      if (!exists) {
        throw new AppException(AppErrors.CART_ITEM_NOT_FOUND);
      }
      await this.redis.hset(key, String(productOptionId), dto.quantity);
      await this.redis.expire(key, CART_TTL_SECONDS);
    }

    return this.getCart(cartId, sessionToken);
  }

  async removeItem(
    cartId: string,
    productOptionId: number,
    sessionToken?: string,
  ): Promise<CartResponse> {
    const userId = await getSessionUserId(this.redis, sessionToken);

    if (userId) {
      const result = await this.cartItemRepository.delete({
        userId,
        productOptionId,
      });
      if (result.affected === 0) {
        throw new AppException(AppErrors.CART_ITEM_NOT_FOUND);
      }
    } else {
      const removed = await this.redis.hdel(
        this.key(cartId),
        String(productOptionId),
      );
      if (removed === 0) {
        throw new AppException(AppErrors.CART_ITEM_NOT_FOUND);
      }
    }

    return this.getCart(cartId, sessionToken);
  }

  /**
   * 로그인 시 게스트 장바구니(Redis)를 로그인 사용자 장바구니(DB)로 병합한다.
   * 겹치는 상품은 수량을 더하고, 병합 후 게스트 장바구니는 삭제한다. 게스트
   * 장바구니가 비어 있으면 아무것도 하지 않는다(이슈 #65).
   */
  async mergeGuestCartIntoUser(cartId: string, userId: number): Promise<void> {
    const key = this.key(cartId);
    const raw = await this.redis.hgetall(key);
    const entries = Object.entries(raw);
    if (entries.length === 0) {
      return;
    }

    for (const [productOptionIdStr, quantityStr] of entries) {
      await this.upsertDbItem(
        userId,
        Number(productOptionIdStr),
        Number(quantityStr),
      );
    }

    await this.redis.del(key);
  }

  private async upsertDbItem(
    userId: number,
    productOptionId: number,
    additionalQuantity: number,
  ): Promise<void> {
    const existing = await this.cartItemRepository.findOne({
      where: { userId, productOptionId },
    });

    if (existing) {
      existing.quantity += additionalQuantity;
      await this.cartItemRepository.save(existing);
    } else {
      await this.cartItemRepository.save(
        this.cartItemRepository.create({
          userId,
          productOptionId,
          quantity: additionalQuantity,
        }),
      );
    }
  }

  private async getRedisQuantities(
    cartId: string,
  ): Promise<Map<number, number>> {
    const raw = await this.redis.hgetall(this.key(cartId));
    const map = new Map<number, number>();
    for (const [id, quantity] of Object.entries(raw)) {
      map.set(Number(id), Number(quantity));
    }
    return map;
  }

  private async getDbQuantities(userId: number): Promise<Map<number, number>> {
    const items = await this.cartItemRepository.find({ where: { userId } });
    return new Map(items.map((item) => [item.productOptionId, item.quantity]));
  }

  private async buildResponse(
    quantityByOptionId: Map<number, number>,
  ): Promise<{ response: CartResponse; staleIds: number[] }> {
    if (quantityByOptionId.size === 0) {
      return { response: { items: [], totalAmount: 0 }, staleIds: [] };
    }

    const optionIds = [...quantityByOptionId.keys()];
    const options = await this.productOptionRepository.find({
      where: { id: In(optionIds) },
      relations: { product: true },
    });
    const optionById = new Map(options.map((option) => [option.id, option]));

    const staleIds = optionIds.filter((id) => !optionById.has(id));

    const items = optionIds
      .map((optionId) => {
        const option = optionById.get(optionId);
        if (!option) {
          return null;
        }

        const unitPrice = option.product.basePrice;
        const quantity = quantityByOptionId.get(optionId)!;

        return {
          productOptionId: option.id,
          productId: option.product.id,
          productName: option.product.name,
          size: option.size,
          color: option.color,
          unitPrice,
          quantity,
          stock: option.stock,
          lineTotal: unitPrice * quantity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

    return { response: { items, totalAmount }, staleIds };
  }
}
