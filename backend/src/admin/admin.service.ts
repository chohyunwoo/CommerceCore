import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProductOption } from '../products/entities/product-option.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order-status.enum';
import { DomainEventsService } from '../common/events/domain-events.service';
import { PaymentsService } from '../payments/payments.service';
import { RecentOrderItem, StockOverviewItem } from './admin.types';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

const RECENT_ORDERS_LIMIT = 20;
const CANCEL_REASON = '관리자에 의한 주문 취소';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(ProductOption)
    private readonly productOptionRepository: Repository<ProductOption>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly domainEvents: DomainEventsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async getStockOverview(): Promise<StockOverviewItem[]> {
    const options = await this.productOptionRepository.find({
      relations: { product: true },
      order: { id: 'ASC' },
    });

    return options.map((option) => ({
      productOptionId: option.id,
      productName: option.product.name,
      size: option.size,
      color: option.color,
      stock: option.stock,
    }));
  }

  async updateOrderStatus(
    orderNumber: string,
    newStatus: OrderStatus,
  ): Promise<RecentOrderItem> {
    const order = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { orderNumber },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new AppException(
          AppErrors.ORDER_NOT_FOUND,
          `주문(${orderNumber})을 찾을 수 없습니다.`,
        );
      }

      const allowed = VALID_TRANSITIONS[order.status];
      if (!allowed.includes(newStatus)) {
        throw new AppException(
          AppErrors.ORDER_STATUS_TRANSITION_INVALID,
          `${order.status} → ${newStatus} 전이는 허용되지 않습니다.`,
        );
      }

      if (
        newStatus === OrderStatus.CANCELLED &&
        order.status === OrderStatus.PAID
      ) {
        if (!order.paymentKey) {
          throw new AppException(
            AppErrors.PAYMENT_CANCEL_FAILED,
            '결제 키 정보가 없어 자동으로 취소할 수 없습니다. TossPayments 콘솔에서 수동으로 확인해주세요.',
          );
        }
        await this.paymentsService.cancel(order.paymentKey, CANCEL_REASON);
      }

      order.status = newStatus;
      return manager.save(order);
    });

    const updated: RecentOrderItem = {
      orderNumber: order.orderNumber,
      status: order.status,
      buyerName: order.buyerName,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    };

    this.domainEvents.emitOrderUpdate(updated);
    return updated;
  }

  async getRecentOrders(): Promise<RecentOrderItem[]> {
    const orders = await this.orderRepository.find({
      order: { createdAt: 'DESC' },
      take: RECENT_ORDERS_LIMIT,
    });

    return orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      buyerName: order.buyerName,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    }));
  }
}
