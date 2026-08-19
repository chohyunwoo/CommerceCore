import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ProductOption } from '../products/entities/product-option.entity';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order-status.enum';
import { DomainEventsService } from '../common/events/domain-events.service';
import { PaymentsService } from '../payments/payments.service';
import {
  CategoryItem,
  RecentOrderItem,
  StockOverviewItem,
} from './admin.types';
import { CreateProductDto } from './dto/create-product.dto';
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
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly domainEvents: DomainEventsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async getCategories(): Promise<CategoryItem[]> {
    const categories = await this.categoryRepository.find({
      order: { id: 'ASC' },
    });
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
    }));
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const category = await this.categoryRepository.findOne({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new AppException(
        AppErrors.CATEGORY_NOT_FOUND,
        `카테고리(id: ${dto.categoryId})를 찾을 수 없습니다.`,
      );
    }

    const skus = dto.options.map((option) => option.sku);
    const skusWithinRequest = new Set(skus);
    if (skusWithinRequest.size !== skus.length) {
      throw new AppException(
        AppErrors.SKU_ALREADY_EXISTS,
        '요청 안에 중복된 SKU가 있습니다.',
      );
    }

    const duplicateSku = await this.productOptionRepository.findOne({
      where: { sku: In(skus) },
    });
    if (duplicateSku) {
      throw new AppException(
        AppErrors.SKU_ALREADY_EXISTS,
        `SKU(${duplicateSku.sku})가 이미 존재합니다.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const product = await manager.save(
        manager.create(Product, {
          categoryId: dto.categoryId,
          name: dto.name,
          description: dto.description ?? null,
          basePrice: dto.basePrice,
          imageUrl: dto.imageUrl,
          imageEmbedding: dto.imageEmbedding,
        }),
      );

      const options = dto.options.map((option) =>
        manager.create(ProductOption, {
          productId: product.id,
          size: option.size,
          color: option.color,
          stock: option.stock,
          sku: option.sku,
        }),
      );
      product.options = await manager.save(options);
      product.category = category;

      return product;
    });
  }

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
