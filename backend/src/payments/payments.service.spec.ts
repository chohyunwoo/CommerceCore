import { PaymentsService } from './payments.service';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order-status.enum';
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

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 300, status, json: () => Promise.resolve(body) };
}

function createPaymentsService(order: Partial<Order> | null) {
  const orderRecord = order ? { ...order } : null;

  const manager = {
    findOne: jest.fn(() => Promise.resolve(orderRecord)),
    save: jest.fn((arg: unknown) => Promise.resolve(arg)),
  };
  const dataSource = {
    transaction: jest.fn((cb: (manager: unknown) => Promise<unknown>) =>
      cb(manager),
    ),
  };
  const configService = { get: jest.fn(() => 'test-secret') };
  const domainEvents = { emitOrderUpdate: jest.fn() };

  const service = new PaymentsService(
    dataSource as never,
    configService as never,
    domainEvents as never,
  );

  return { service, orderRecord, domainEvents };
}

const baseDto = { paymentKey: 'pay_1', orderId: 'ORD-1', amount: 10000 };

describe('PaymentsService.confirm', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('주문이 없으면 ORDER_NOT_FOUND를 던진다', async () => {
    const { service } = createPaymentsService(null);
    await expectAppError(service.confirm(baseDto), AppErrors.ORDER_NOT_FOUND);
  });

  it('이미 PENDING이 아닌 주문이면 PAYMENT_ALREADY_PROCESSED를 던진다', async () => {
    const { service } = createPaymentsService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PAID,
      totalAmount: 10000,
    });
    await expectAppError(
      service.confirm(baseDto),
      AppErrors.PAYMENT_ALREADY_PROCESSED,
    );
  });

  it('금액이 다르면 PAYMENT_AMOUNT_MISMATCH를 던진다', async () => {
    const { service } = createPaymentsService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PENDING,
      totalAmount: 9999,
    });
    await expectAppError(
      service.confirm(baseDto),
      AppErrors.PAYMENT_AMOUNT_MISMATCH,
    );
  });

  it('Toss가 성공 응답하면 주문이 PAID로 전이되고 이벤트가 발행된다', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, {}));
    const { service, orderRecord, domainEvents } = createPaymentsService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PENDING,
      totalAmount: 10000,
    });

    const result = await service.confirm(baseDto);

    expect(result.status).toBe(OrderStatus.PAID);
    expect(orderRecord?.status).toBe(OrderStatus.PAID);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(domainEvents.emitOrderUpdate).toHaveBeenCalledTimes(1);
  });

  it('5xx 응답 후 재시도하면 성공한다', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { message: '서버 오류' }))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    const { service } = createPaymentsService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PENDING,
      totalAmount: 10000,
    });

    const result = await service.confirm(baseDto);

    expect(result.status).toBe(OrderStatus.PAID);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  }, 10000);

  it('5xx 응답이 재시도 후에도 계속되면 PAYMENT_PG_CONFIRM_FAILED를 던진다', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(503, { message: '서비스 불가' }));
    const { service } = createPaymentsService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PENDING,
      totalAmount: 10000,
    });

    await expectAppError(
      service.confirm(baseDto),
      AppErrors.PAYMENT_PG_CONFIRM_FAILED,
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
  }, 10000);

  it('네트워크 오류가 발생하면 재시도 후 성공한다', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    const { service } = createPaymentsService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PENDING,
      totalAmount: 10000,
    });

    const result = await service.confirm(baseDto);

    expect(result.status).toBe(OrderStatus.PAID);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  }, 10000);

  it('ALREADY_PROCESSED_PAYMENT 응답이면 에러 없이 PAID로 동기화된다', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(400, {
        code: 'ALREADY_PROCESSED_PAYMENT',
        message: '이미 처리된 결제 입니다.',
      }),
    );
    const { service, orderRecord } = createPaymentsService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PENDING,
      totalAmount: 10000,
    });

    const result = await service.confirm(baseDto);

    expect(result.status).toBe(OrderStatus.PAID);
    expect(orderRecord?.status).toBe(OrderStatus.PAID);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('그 외 4xx 응답이면 재시도 없이 즉시 실패한다', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(400, { message: '유효하지 않은 요청' }));
    const { service } = createPaymentsService({
      orderNumber: 'ORD-1',
      status: OrderStatus.PENDING,
      totalAmount: 10000,
    });

    await expectAppError(
      service.confirm(baseDto),
      AppErrors.PAYMENT_PG_CONFIRM_FAILED,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
