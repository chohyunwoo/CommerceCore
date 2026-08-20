import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order-status.enum';
import { ProductOption } from '../products/entities/product-option.entity';
import { Product } from '../products/entities/product.entity';
import { AppException } from '../common/errors/app-exception';
import { AppErrors, AppErrorDefinition } from '../common/errors/app-errors';

async function expectAppError(
  promise: Promise<unknown>,
  def: AppErrorDefinition,
) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  try {
    await promise;
    throw new Error('expected promise to reject');
  } catch (err) {
    const body = (err as AppException).getResponse() as {
      code: string;
      statusCode: number;
    };
    expect(body.code).toBe(def.code);
    expect(body.statusCode).toBe(def.status);
  }
}

interface ManagerMockOptions {
  options?: Partial<ProductOption>[];
  products?: Partial<Product>[];
  orderNumberExists?: boolean[];
}

function createManagerMock({
  options = [],
  products = [],
  orderNumberExists = [false],
}: ManagerMockOptions) {
  const existsQueue = [...orderNumberExists];

  const manager = {
    find: jest.fn((entity: unknown) => {
      if (entity === ProductOption) return Promise.resolve(options);
      if (entity === Product) return Promise.resolve(products);
      return Promise.resolve([]);
    }),
    exists: jest.fn(() =>
      Promise.resolve(existsQueue.length ? existsQueue.shift() : false),
    ),
    create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
    save: jest.fn((arg: unknown) => Promise.resolve(arg)),
  };

  return manager;
}

function createOrdersService(managerOptions: ManagerMockOptions) {
  const manager = createManagerMock(managerOptions);
  const dataSource = {
    transaction: jest.fn((cb: (manager: unknown) => Promise<unknown>) =>
      cb(manager),
    ),
  };
  const redis = { del: jest.fn().mockResolvedValue(1) };
  const domainEvents = {
    emitStockUpdate: jest.fn(),
    emitOrderUpdate: jest.fn(),
  };

  const service = new OrdersService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    dataSource as never,
    redis as never,
    domainEvents as never,
  );

  return { service, manager, dataSource, redis, domainEvents };
}

describe('OrdersService.createOrder', () => {
  it('재고가 충분하면 주문을 생성하고 재고를 차감한다', async () => {
    const { service, manager, redis, domainEvents } = createOrdersService({
      options: [{ id: 10, productId: 1, stock: 5, size: 'M', color: '블랙' }],
      products: [{ id: 1, basePrice: 10000, name: '베이직 반팔티' }],
      orderNumberExists: [false],
    });

    const result = await service.createOrder('cart-1', {
      buyerEmail: 'buyer@example.com',
      buyerName: '홍길동',
      buyerPhone: '010-0000-0000',
      postalCode: '06236',
      baseAddress: '서울시 어딘가',
      items: [{ productOptionId: 10, quantity: 2 }],
    });

    expect(result.status).toBe(OrderStatus.PENDING);
    expect(result.totalAmount).toBe(20000);

    const savedOptionsCall = manager.save.mock.calls.find(
      ([arg]) =>
        Array.isArray(arg) && (arg as ProductOption[])[0]?.stock !== undefined,
    );
    expect(savedOptionsCall?.[0]).toEqual([
      expect.objectContaining({ id: 10, stock: 3 }),
    ]);

    expect(domainEvents.emitStockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ productOptionId: 10, stock: 3 }),
    );
    expect(domainEvents.emitOrderUpdate).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledWith('cart:cart-1');
  });

  it('재고가 부족하면 STOCK_INSUFFICIENT를 던지고 아무것도 저장하지 않는다', async () => {
    const { service, manager } = createOrdersService({
      options: [{ id: 10, productId: 1, stock: 1, size: 'M', color: '블랙' }],
      products: [{ id: 1, basePrice: 10000, name: '베이직 반팔티' }],
    });

    await expectAppError(
      service.createOrder('cart-1', {
        buyerEmail: 'buyer@example.com',
        buyerName: '홍길동',
        buyerPhone: '010-0000-0000',
        postalCode: '06236',
        baseAddress: '서울시 어딘가',
        items: [{ productOptionId: 10, quantity: 2 }],
      }),
      AppErrors.STOCK_INSUFFICIENT,
    );

    expect(manager.save).not.toHaveBeenCalled();
  });

  it('주문번호가 5회 모두 중복되면 ORDER_NUMBER_GENERATION_FAILED를 던진다', async () => {
    const { service } = createOrdersService({
      options: [{ id: 10, productId: 1, stock: 5, size: 'M', color: '블랙' }],
      products: [{ id: 1, basePrice: 10000, name: '베이직 반팔티' }],
      orderNumberExists: [true, true, true, true, true],
    });

    await expectAppError(
      service.createOrder('cart-1', {
        buyerEmail: 'buyer@example.com',
        buyerName: '홍길동',
        buyerPhone: '010-0000-0000',
        postalCode: '06236',
        baseAddress: '서울시 어딘가',
        items: [{ productOptionId: 10, quantity: 1 }],
      }),
      AppErrors.ORDER_NUMBER_GENERATION_FAILED,
    );
  });
});
