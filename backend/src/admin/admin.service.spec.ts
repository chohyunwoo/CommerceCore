import { AdminService } from './admin.service';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order-status.enum';
import { DeliveryEvent } from '../orders/entities/delivery-event.entity';
import { DeliveryStage } from '../orders/entities/delivery-stage.enum';
import { Carrier } from '../orders/entities/carrier.enum';
import { CreateProductDto } from './dto/create-product.dto';
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

function createAdminService(
  order: Partial<Order> | null,
  existingEvents: Partial<DeliveryEvent>[] = [],
) {
  const orderRecord = order ? { ...order } : null;

  const manager = {
    findOne: jest.fn(() => Promise.resolve(orderRecord)),
    find: jest.fn(() => Promise.resolve(existingEvents)),
    save: jest.fn((arg: unknown) => Promise.resolve(arg)),
    create: jest.fn((_entity: unknown, arg: unknown) => arg),
  };
  const dataSource = {
    transaction: jest.fn((cb: (manager: unknown) => Promise<unknown>) =>
      cb(manager),
    ),
  };
  const domainEvents = { emitOrderUpdate: jest.fn() };
  const paymentsService = { cancel: jest.fn().mockResolvedValue(undefined) };
  const productOptionRepository = { findOne: jest.fn() };
  const categoryRepository = { find: jest.fn(), findOne: jest.fn() };
  const deliveryEventRepository = { find: jest.fn().mockResolvedValue([]) };

  const service = new AdminService(
    productOptionRepository as never,
    {} as never,
    categoryRepository as never,
    deliveryEventRepository as never,
    dataSource as never,
    domainEvents as never,
    paymentsService as never,
  );

  return {
    service,
    orderRecord,
    manager,
    domainEvents,
    paymentsService,
    productOptionRepository,
    categoryRepository,
    deliveryEventRepository,
  };
}

function buildCreateProductDto(
  overrides: Partial<CreateProductDto> = {},
): CreateProductDto {
  return {
    categoryId: 1,
    name: '에어맥스 90',
    basePrice: 139000,
    imageUrl: 'https://example.com/products/airmax90.jpg',
    imageEmbedding: [0.1, 0.2, 0.3],
    options: [{ size: '270', color: '블랙', stock: 10, sku: 'SHOE-001' }],
    ...overrides,
  };
}

describe('AdminService.updateOrderStatus', () => {
  it('주문이 없으면 ORDER_NOT_FOUND를 던진다', async () => {
    const { service } = createAdminService(null);
    await expectAppError(
      service.updateOrderStatus('ORD-1', OrderStatus.CANCELLED),
      AppErrors.ORDER_NOT_FOUND,
    );
  });

  it('허용되지 않는 전이면 ORDER_STATUS_TRANSITION_INVALID를 던진다', async () => {
    const { service } = createAdminService({
      orderNumber: 'ORD-1',
      status: OrderStatus.DELIVERED,
    });
    await expectAppError(
      service.updateOrderStatus('ORD-1', OrderStatus.CANCELLED),
      AppErrors.ORDER_STATUS_TRANSITION_INVALID,
    );
  });

  it('PENDING → CANCELLED는 Toss를 호출하지 않고 즉시 처리된다', async () => {
    const { service, orderRecord, paymentsService, domainEvents } =
      createAdminService({
        orderNumber: 'ORD-1',
        status: OrderStatus.PENDING,
        paymentKey: null,
        buyerName: '홍길동',
        totalAmount: 10000,
        createdAt: new Date('2026-08-18T00:00:00.000Z'),
      });

    const result = await service.updateOrderStatus(
      'ORD-1',
      OrderStatus.CANCELLED,
    );

    expect(result.status).toBe(OrderStatus.CANCELLED);
    expect(orderRecord?.status).toBe(OrderStatus.CANCELLED);
    expect(paymentsService.cancel).not.toHaveBeenCalled();
    expect(domainEvents.emitOrderUpdate).toHaveBeenCalledTimes(1);
  });

  it('PAID → CANCELLED면 Toss 취소를 호출한 뒤 상태를 변경한다', async () => {
    const { service, orderRecord, paymentsService } = createAdminService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PAID,
      paymentKey: 'pay_1',
      buyerName: '홍길동',
      totalAmount: 10000,
      createdAt: new Date('2026-08-18T00:00:00.000Z'),
    });

    const result = await service.updateOrderStatus(
      'ORD-1',
      OrderStatus.CANCELLED,
    );

    expect(paymentsService.cancel).toHaveBeenCalledWith(
      'pay_1',
      '관리자에 의한 주문 취소',
    );
    expect(result.status).toBe(OrderStatus.CANCELLED);
    expect(orderRecord?.status).toBe(OrderStatus.CANCELLED);
  });

  it('Toss 취소가 실패하면 주문 상태를 변경하지 않는다', async () => {
    const { service, orderRecord, manager, paymentsService } =
      createAdminService({
        orderNumber: 'ORD-1',
        status: OrderStatus.PAID,
        paymentKey: 'pay_1',
      });
    paymentsService.cancel.mockRejectedValue(
      new AppException(AppErrors.PAYMENT_CANCEL_FAILED),
    );

    await expectAppError(
      service.updateOrderStatus('ORD-1', OrderStatus.CANCELLED),
      AppErrors.PAYMENT_CANCEL_FAILED,
    );

    expect(manager.save).not.toHaveBeenCalled();
    expect(orderRecord?.status).toBe(OrderStatus.PAID);
  });

  it('paymentKey가 없는 PAID 주문은 취소 시 즉시 실패하고 Toss를 호출하지 않는다', async () => {
    const { service, manager, paymentsService } = createAdminService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PAID,
      paymentKey: null,
    });

    await expectAppError(
      service.updateOrderStatus('ORD-1', OrderStatus.CANCELLED),
      AppErrors.PAYMENT_CANCEL_FAILED,
    );

    expect(paymentsService.cancel).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
});

describe('AdminService.getCategories', () => {
  it('카테고리를 id 목록 형태로 반환한다', async () => {
    const { service, categoryRepository } = createAdminService(null);
    categoryRepository.find.mockResolvedValue([
      { id: 1, name: '신발' },
      { id: 2, name: '상의' },
    ]);

    const result = await service.getCategories();

    expect(result).toEqual([
      { id: 1, name: '신발' },
      { id: 2, name: '상의' },
    ]);
  });
});

describe('AdminService.createProduct', () => {
  it('존재하지 않는 카테고리면 CATEGORY_NOT_FOUND를 던진다', async () => {
    const { service, categoryRepository } = createAdminService(null);
    categoryRepository.findOne.mockResolvedValue(null);

    await expectAppError(
      service.createProduct(buildCreateProductDto()),
      AppErrors.CATEGORY_NOT_FOUND,
    );
  });

  it('요청 안에 중복 SKU가 있으면 SKU_ALREADY_EXISTS를 던진다', async () => {
    const { service, categoryRepository } = createAdminService(null);
    categoryRepository.findOne.mockResolvedValue({ id: 1, name: '신발' });

    await expectAppError(
      service.createProduct(
        buildCreateProductDto({
          options: [
            { size: '270', color: '블랙', stock: 10, sku: 'SHOE-001' },
            { size: '280', color: '블랙', stock: 5, sku: 'SHOE-001' },
          ],
        }),
      ),
      AppErrors.SKU_ALREADY_EXISTS,
    );
  });

  it('DB에 이미 존재하는 SKU면 SKU_ALREADY_EXISTS를 던진다', async () => {
    const { service, categoryRepository, productOptionRepository } =
      createAdminService(null);
    categoryRepository.findOne.mockResolvedValue({ id: 1, name: '신발' });
    productOptionRepository.findOne.mockResolvedValue({
      id: 99,
      sku: 'SHOE-001',
    });

    await expectAppError(
      service.createProduct(buildCreateProductDto()),
      AppErrors.SKU_ALREADY_EXISTS,
    );
  });

  it('정상 요청이면 상품과 옵션을 생성해 반환한다', async () => {
    const { service, categoryRepository, productOptionRepository, manager } =
      createAdminService(null);
    categoryRepository.findOne.mockResolvedValue({ id: 1, name: '신발' });
    productOptionRepository.findOne.mockResolvedValue(null);
    manager.save.mockImplementation((arg: unknown) => {
      if (Array.isArray(arg)) {
        const options = arg as Record<string, unknown>[];
        return Promise.resolve(
          options.map((option, index) => ({ id: index + 1, ...option })),
        );
      }
      return Promise.resolve({ id: 1, ...(arg as Record<string, unknown>) });
    });

    const result = await service.createProduct(buildCreateProductDto());

    expect(result.id).toBe(1);
    expect(result.name).toBe('에어맥스 90');
    expect(result.options).toHaveLength(1);
    expect(result.options[0]).toMatchObject({
      productId: 1,
      sku: 'SHOE-001',
    });
    expect(result.category).toEqual({ id: 1, name: '신발' });
  });
});

describe('AdminService.updateOrderStatus - 배송 추적', () => {
  it('PAID → SHIPPED 전이 시 송장번호/택배사를 저장한다', async () => {
    const { service, orderRecord } = createAdminService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PAID,
      buyerName: '홍길동',
      totalAmount: 10000,
      createdAt: new Date('2026-08-18T00:00:00.000Z'),
    });

    const result = await service.updateOrderStatus(
      'ORD-1',
      OrderStatus.SHIPPED,
      '1234567890',
      Carrier.CJ_LOGISTICS,
    );

    expect(result.trackingNumber).toBe('1234567890');
    expect(result.carrier).toBe(Carrier.CJ_LOGISTICS);
    expect(orderRecord?.trackingNumber).toBe('1234567890');
    expect(orderRecord?.carrier).toBe(Carrier.CJ_LOGISTICS);
  });

  it('SHIPPED → DELIVERED로 직접 전이할 수 없다 (배송 단계 기록으로만 가능)', async () => {
    const { service } = createAdminService({
      orderNumber: 'ORD-1',
      status: OrderStatus.SHIPPED,
    });

    await expectAppError(
      service.updateOrderStatus('ORD-1', OrderStatus.DELIVERED),
      AppErrors.ORDER_STATUS_TRANSITION_INVALID,
    );
  });
});

describe('AdminService.addDeliveryEvent', () => {
  it('주문이 없으면 ORDER_NOT_FOUND를 던진다', async () => {
    const { service } = createAdminService(null);
    await expectAppError(
      service.addDeliveryEvent('ORD-1', { stage: DeliveryStage.COLLECTED }),
      AppErrors.ORDER_NOT_FOUND,
    );
  });

  it('SHIPPED 상태가 아니면 DELIVERY_EVENT_ORDER_NOT_SHIPPED를 던진다', async () => {
    const { service } = createAdminService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PAID,
    });

    await expectAppError(
      service.addDeliveryEvent('ORD-1', { stage: DeliveryStage.COLLECTED }),
      AppErrors.DELIVERY_EVENT_ORDER_NOT_SHIPPED,
    );
  });

  it('첫 단계를 건너뛰고 기록하면 DELIVERY_STAGE_ORDER_INVALID를 던진다', async () => {
    const { service } = createAdminService(
      { orderNumber: 'ORD-1', status: OrderStatus.SHIPPED },
      [],
    );

    await expectAppError(
      service.addDeliveryEvent('ORD-1', { stage: DeliveryStage.IN_TRANSIT }),
      AppErrors.DELIVERY_STAGE_ORDER_INVALID,
    );
  });

  it('이미 기록된 단계를 중복 기록하면 DELIVERY_STAGE_ORDER_INVALID를 던진다', async () => {
    const { service } = createAdminService(
      { orderNumber: 'ORD-1', status: OrderStatus.SHIPPED },
      [
        {
          stage: DeliveryStage.COLLECTED,
          occurredAt: new Date('2026-08-18T01:00:00.000Z'),
        },
      ],
    );

    await expectAppError(
      service.addDeliveryEvent('ORD-1', { stage: DeliveryStage.COLLECTED }),
      AppErrors.DELIVERY_STAGE_ORDER_INVALID,
    );
  });

  it('순서대로 기록하면 이벤트가 타임라인에 추가된다', async () => {
    const { service, domainEvents } = createAdminService(
      {
        orderNumber: 'ORD-1',
        status: OrderStatus.SHIPPED,
        buyerName: '홍길동',
        totalAmount: 10000,
        createdAt: new Date('2026-08-18T00:00:00.000Z'),
      },
      [
        {
          stage: DeliveryStage.COLLECTED,
          occurredAt: new Date('2026-08-18T01:00:00.000Z'),
        },
      ],
    );

    const result = await service.addDeliveryEvent('ORD-1', {
      stage: DeliveryStage.IN_TRANSIT,
      location: '서울 동부 터미널',
    });

    expect(result.deliveryEvents).toHaveLength(2);
    expect(result.deliveryEvents[1]).toMatchObject({
      stage: DeliveryStage.IN_TRANSIT,
      location: '서울 동부 터미널',
    });
    expect(result.status).toBe(OrderStatus.SHIPPED);
    expect(domainEvents.emitOrderUpdate).toHaveBeenCalledTimes(1);
  });

  it('마지막 단계(DELIVERED)를 기록하면 주문 status도 DELIVERED로 전이된다', async () => {
    const { service, orderRecord } = createAdminService(
      { orderNumber: 'ORD-1', status: OrderStatus.SHIPPED },
      [
        {
          stage: DeliveryStage.COLLECTED,
          occurredAt: new Date('2026-08-18T01:00:00.000Z'),
        },
        {
          stage: DeliveryStage.IN_TRANSIT,
          occurredAt: new Date('2026-08-18T02:00:00.000Z'),
        },
        {
          stage: DeliveryStage.OUT_FOR_DELIVERY,
          occurredAt: new Date('2026-08-18T03:00:00.000Z'),
        },
      ],
    );

    const result = await service.addDeliveryEvent('ORD-1', {
      stage: DeliveryStage.DELIVERED,
    });

    expect(result.status).toBe(OrderStatus.DELIVERED);
    expect(orderRecord?.status).toBe(OrderStatus.DELIVERED);
  });
});
