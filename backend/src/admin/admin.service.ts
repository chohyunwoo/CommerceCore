import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductOption } from '../products/entities/product-option.entity';
import { Order } from '../orders/entities/order.entity';
import { RecentOrderItem, StockOverviewItem } from './admin.types';

const RECENT_ORDERS_LIMIT = 20;

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(ProductOption)
    private readonly productOptionRepository: Repository<ProductOption>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
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
