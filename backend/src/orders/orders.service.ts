import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { DomainEventsService } from '../common/events/domain-events.service';
import { ProductOption } from '../products/entities/product-option.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatus } from './entities/order-status.enum';
import { generateOrderNumber } from './order-number.util';
import { ValidateStockDto } from './dto/validate-stock.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { LookupOrderQueryDto } from './dto/lookup-order-query.dto';
import {
  CreateOrderResponse,
  InsufficientStockItem,
  OrderLookupResponse,
  ValidateStockResponse,
} from './orders.types';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(ProductOption)
    private readonly productOptionRepository: Repository<ProductOption>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async validateStock(dto: ValidateStockDto): Promise<ValidateStockResponse> {
    const optionIds = dto.items.map((item) => item.productOptionId);
    const options = await this.productOptionRepository.find({
      where: { id: In(optionIds) },
      relations: { product: true },
    });
    const optionById = new Map(options.map((option) => [option.id, option]));

    const insufficientItems: InsufficientStockItem[] = [];

    for (const item of dto.items) {
      const option = optionById.get(item.productOptionId);

      if (!option) {
        insufficientItems.push({
          productOptionId: item.productOptionId,
          productName: '알 수 없는 상품',
          size: '-',
          color: '-',
          requestedQuantity: item.quantity,
          availableStock: 0,
        });
        continue;
      }

      if (option.stock < item.quantity) {
        insufficientItems.push({
          productOptionId: option.id,
          productName: option.product.name,
          size: option.size,
          color: option.color,
          requestedQuantity: item.quantity,
          availableStock: option.stock,
        });
      }
    }

    if (insufficientItems.length === 0) {
      return { valid: true };
    }

    return { valid: false, insufficientItems };
  }

  async createOrder(
    cartId: string,
    dto: CreateOrderDto,
  ): Promise<CreateOrderResponse> {
    const quantityByOptionId = new Map(
      dto.items.map((item) => [item.productOptionId, item.quantity]),
    );
    const optionIds = [...quantityByOptionId.keys()].sort((a, b) => a - b);

    const { order, options, productById } = await this.dataSource.transaction(
      async (manager) => {
        const options = await manager.find(ProductOption, {
          where: { id: In(optionIds) },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        const optionById = new Map(
          options.map((option) => [option.id, option]),
        );

        const hasInsufficientStock = optionIds.some((id) => {
          const option = optionById.get(id);
          return !option || option.stock < quantityByOptionId.get(id)!;
        });

        if (hasInsufficientStock) {
          throw new AppException(AppErrors.STOCK_INSUFFICIENT);
        }

        const productIds = [
          ...new Set(options.map((option) => option.productId)),
        ];
        const products = await manager.find(Product, {
          where: { id: In(productIds) },
        });
        const productById = new Map(
          products.map((product) => [product.id, product]),
        );

        let totalAmount = 0;
        const itemDrafts: {
          productOptionId: number;
          quantity: number;
          priceAtOrder: number;
        }[] = [];

        for (const option of options) {
          const quantity = quantityByOptionId.get(option.id)!;
          const priceAtOrder = productById.get(option.productId)!.basePrice;

          option.stock -= quantity;
          totalAmount += priceAtOrder * quantity;
          itemDrafts.push({
            productOptionId: option.id,
            quantity,
            priceAtOrder,
          });
        }

        await manager.save(options);

        const orderNumber = await this.generateUniqueOrderNumber(manager);
        const savedOrder = await manager.save(
          manager.create(Order, {
            orderNumber,
            status: OrderStatus.PENDING,
            buyerEmail: dto.buyerEmail,
            buyerName: dto.buyerName,
            buyerPhone: dto.buyerPhone,
            buyerAddress: dto.buyerAddress,
            totalAmount,
          }),
        );

        const orderItems = itemDrafts.map((draft) =>
          manager.create(OrderItem, { ...draft, order: savedOrder }),
        );
        await manager.save(orderItems);

        return { order: savedOrder, options, productById };
      },
    );

    for (const option of options) {
      this.domainEvents.emitStockUpdate({
        productOptionId: option.id,
        productName: productById.get(option.productId)!.name,
        size: option.size,
        color: option.color,
        stock: option.stock,
      });
    }

    this.domainEvents.emitOrderUpdate({
      orderNumber: order.orderNumber,
      status: order.status,
      buyerName: order.buyerName,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    });

    await this.redis.del(`cart:${cartId}`);

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
    };
  }

  private async generateUniqueOrderNumber(
    manager: EntityManager,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateOrderNumber(new Date());
      const exists = await manager.exists(Order, {
        where: { orderNumber: candidate },
      });
      if (!exists) {
        return candidate;
      }
    }

    throw new AppException(AppErrors.ORDER_NUMBER_GENERATION_FAILED);
  }

  async lookupOrder(query: LookupOrderQueryDto): Promise<OrderLookupResponse> {
    // 존재 확인은 단순 쿼리로 먼저 처리 — 없는 주문이면 무거운 관계(JOIN) 쿼리를
    // 아예 조립하지 않는다. TypeORM이 4개 엔티티에 걸친 relations를 매 요청마다
    // 빌드하는 비용이 CPU가 제한된 환경(Render 무료 티어)에서 눈에 띄게 커서 분리함.
    const order = await this.orderRepository.findOne({
      where: {
        orderNumber: query.orderNumber,
        buyerEmail: query.email,
      },
    });

    if (!order) {
      throw new AppException(AppErrors.ORDER_NOT_FOUND);
    }

    const items = await this.orderItemRepository.find({
      where: { order: { id: order.id } },
      relations: { productOption: { product: true } },
    });

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      buyerPhone: order.buyerPhone,
      buyerAddress: order.buyerAddress,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      items: items.map((item) => ({
        productName: item.productOption.product.name,
        size: item.productOption.size,
        color: item.productOption.color,
        quantity: item.quantity,
        priceAtOrder: item.priceAtOrder,
        lineTotal: item.priceAtOrder * item.quantity,
      })),
    };
  }
}
