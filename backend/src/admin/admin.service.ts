import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductOption } from '../products/entities/product-option.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order-status.enum';
import { DomainEventsService } from '../common/events/domain-events.service';
import { RecentOrderItem, StockOverviewItem } from './admin.types';

const RECENT_ORDERS_LIMIT = 20;

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
    private readonly domainEvents: DomainEventsService,
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
    const order = await this.orderRepository.findOne({ where: { orderNumber } });
    if (!order) {
      throw new NotFoundException(`주문(${orderNumber})을 찾을 수 없습니다.`);
    }

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `${order.status} → ${newStatus} 전이는 허용되지 않습니다.`,
      );
    }

    order.status = newStatus;
    await this.orderRepository.save(order);

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
