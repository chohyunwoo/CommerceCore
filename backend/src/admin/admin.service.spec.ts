import { AdminService } from './admin.service';
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

function createAdminService(order: Partial<Order> | null) {
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
  const domainEvents = { emitOrderUpdate: jest.fn() };
  const paymentsService = { cancel: jest.fn().mockResolvedValue(undefined) };

  const service = new AdminService(
    {} as never,
    {} as never,
    dataSource as never,
    domainEvents as never,
    paymentsService as never,
  );

  return { service, orderRecord, manager, domainEvents, paymentsService };
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
