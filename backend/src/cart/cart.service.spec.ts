import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';
import { AppException } from '../common/errors/app-exception';
import { AppErrors } from '../common/errors/app-errors';

function createCartService(
  options: {
    redisData?: Record<string, string>;
    cartItems?: Partial<CartItem>[];
    sessionUserId?: number;
  } = {},
) {
  const { redisData = {}, cartItems = [], sessionUserId } = options;

  const redis = {
    get: jest
      .fn()
      .mockResolvedValue(
        sessionUserId ? JSON.stringify({ userId: sessionUserId }) : null,
      ),
    hgetall: jest.fn().mockResolvedValue(redisData),
    del: jest.fn().mockResolvedValue(1),
    hincrby: jest.fn().mockResolvedValue(1),
    hset: jest.fn().mockResolvedValue(1),
    hdel: jest.fn().mockResolvedValue(1),
    hexists: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };

  const productOptionRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };

  const cartItemRepository = {
    findOne: jest.fn((query: { where: { productOptionId: number } }) => {
      const match = cartItems.find(
        (item) => item.productOptionId === query.where.productOptionId,
      );
      return Promise.resolve(match ?? null);
    }),
    find: jest.fn().mockResolvedValue(cartItems),
    create: jest.fn((data: Partial<CartItem>) => ({ ...data })),
    save: jest.fn((data: Partial<CartItem>) => Promise.resolve(data)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const service = new CartService(
    redis as never,
    productOptionRepository as never,
    cartItemRepository as never,
  );

  return { service, redis, productOptionRepository, cartItemRepository };
}

describe('CartService.mergeGuestCartIntoUser', () => {
  it('게스트 장바구니가 비어 있으면 아무것도 하지 않는다', async () => {
    const { service, redis, cartItemRepository } = createCartService({
      redisData: {},
    });

    await service.mergeGuestCartIntoUser('cart-1', 1);

    expect(cartItemRepository.save).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('DB에 없는 상품은 새로 추가한다', async () => {
    const { service, redis, cartItemRepository } = createCartService({
      redisData: { '10': '2' },
      cartItems: [],
    });

    await service.mergeGuestCartIntoUser('cart-1', 1);

    expect(cartItemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, productOptionId: 10, quantity: 2 }),
    );
    expect(redis.del).toHaveBeenCalledWith('cart:cart-1');
  });

  it('DB에 이미 있는 상품은 수량을 합산한다', async () => {
    const { service, cartItemRepository } = createCartService({
      redisData: { '10': '2' },
      cartItems: [{ userId: 1, productOptionId: 10, quantity: 3 }],
    });

    await service.mergeGuestCartIntoUser('cart-1', 1);

    expect(cartItemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ productOptionId: 10, quantity: 5 }),
    );
  });

  it('여러 상품이 섞여 있으면 각각 올바르게 병합한다', async () => {
    const { service, cartItemRepository } = createCartService({
      redisData: { '10': '2', '20': '1' },
      cartItems: [{ userId: 1, productOptionId: 10, quantity: 3 }],
    });

    await service.mergeGuestCartIntoUser('cart-1', 1);

    expect(cartItemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ productOptionId: 10, quantity: 5 }),
    );
    expect(cartItemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, productOptionId: 20, quantity: 1 }),
    );
  });
});

describe('CartService.getCart', () => {
  it('세션이 없으면 Redis(게스트) 장바구니를 조회한다', async () => {
    const { service, cartItemRepository } = createCartService({
      redisData: {},
    });

    const result = await service.getCart('cart-1');

    expect(result).toEqual({ items: [], totalAmount: 0 });
    expect(cartItemRepository.find).not.toHaveBeenCalled();
  });

  it('유효한 세션이 있으면 DB(로그인 사용자) 장바구니를 조회한다', async () => {
    const { service, cartItemRepository } = createCartService({
      sessionUserId: 1,
      cartItems: [],
    });

    await service.getCart('cart-1', 'valid-token');

    expect(cartItemRepository.find).toHaveBeenCalledWith({
      where: { userId: 1 },
    });
  });
});

describe('CartService.updateItem / removeItem — 존재하지 않는 항목', () => {
  it('로그인 사용자의 없는 항목을 수정하면 CART_ITEM_NOT_FOUND', async () => {
    const { service, cartItemRepository } = createCartService({
      sessionUserId: 1,
    });
    cartItemRepository.update.mockResolvedValue({ affected: 0 });

    await expect(
      service.updateItem('cart-1', 999, { quantity: 2 }, 'valid-token'),
    ).rejects.toBeInstanceOf(AppException);
  });

  it('게스트의 없는 항목을 삭제하면 CART_ITEM_NOT_FOUND', async () => {
    const { service, redis } = createCartService();
    redis.hdel.mockResolvedValue(0);

    await expect(service.removeItem('cart-1', 999)).rejects.toBeInstanceOf(
      AppException,
    );
    try {
      await service.removeItem('cart-1', 999);
      throw new Error('expected promise to reject');
    } catch (err) {
      const body = (err as AppException).getResponse() as { code: string };
      expect(body.code).toBe(AppErrors.CART_ITEM_NOT_FOUND.code);
    }
  });
});
