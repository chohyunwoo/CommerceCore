import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { DomainEventsService } from '../common/events/domain-events.service';
import { ProductOption } from '../products/entities/product-option.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { DeliveryEvent } from './entities/delivery-event.entity';
import {
  HIDDEN_ORDER_STATUSES,
  OrderStatus,
} from './entities/order-status.enum';
import type { StockUpdateEvent } from '../common/events/domain-events.types';
import { generateOrderNumber } from './order-number.util';
import { ValidateStockDto } from './dto/validate-stock.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { LookupOrderQueryDto } from './dto/lookup-order-query.dto';
import {
  CreateOrderResponse,
  InsufficientStockItem,
  MyOrderItem,
  OrderLookupResponse,
  PaginatedMyOrders,
  ValidateStockResponse,
} from './orders.types';
import { getSessionUserId } from '../common/session/session.util';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

// 결제창까지 갔다가 이탈해 PENDING으로 방치된 주문은 재고를 계속 점유한다(유령 재고).
// 이 시간이 지난 PENDING은 만료 회수(재고 반납 + EXPIRED 전이)한다(결정 45).
const PENDING_ORDER_TTL_MS = 30 * 60 * 1000; // 30분

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(ProductOption)
    private readonly productOptionRepository: Repository<ProductOption>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(DeliveryEvent)
    private readonly deliveryEventRepository: Repository<DeliveryEvent>,
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
    sessionToken?: string,
  ): Promise<CreateOrderResponse> {
    const userId = await getSessionUserId(this.redis, sessionToken);
    const quantityByOptionId = new Map(
      dto.items.map((item) => [item.productOptionId, item.quantity]),
    );
    const optionIds = [...quantityByOptionId.keys()].sort((a, b) => a - b);

    // 사려는 옵션을 점유한 만료 PENDING을 먼저 회수해 재고를 되돌린 뒤 주문을 시작한다
    // (결정 45 — lazy 회수). Render 무료 티어 슬립 중엔 cron이 못 도므로, 재고가
    // 실제로 필요한 이 시점에 회수하는 것이 가장 확실하다.
    await this.reclaimExpiredPendingOrders(optionIds);

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
        // buyer_address는 하위호환/표시용 — base_address + detail_address를 합쳐 채운다 (이슈 #52).
        const buyerAddress = [dto.baseAddress, dto.detailAddress]
          .filter(Boolean)
          .join(' ');
        const savedOrder = await manager.save(
          manager.create(Order, {
            orderNumber,
            status: OrderStatus.PENDING,
            buyerEmail: dto.buyerEmail,
            buyerName: dto.buyerName,
            buyerPhone: dto.buyerPhone,
            buyerAddress,
            postalCode: dto.postalCode,
            baseAddress: dto.baseAddress,
            detailAddress: dto.detailAddress ?? null,
            totalAmount,
            userId,
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
        productId: option.productId,
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

  /**
   * 방치된 PENDING 주문(생성 후 TTL 경과)을 만료 회수한다(결정 45). 주문 행을 락 잡고
   * 여전히 PENDING이면 재고를 반납하고 EXPIRED로 전이한다. confirm()도 같은 주문 행을
   * 락 잡고 status===PENDING을 확인하므로, 회수와 결제 승인은 직렬화된다(둘 중 먼저 커밋한
   * 쪽이 이김 — TTL을 30분으로 넉넉히 둬 정상 결제가 거의 항상 먼저 도착한다).
   * @param optionIds 주어지면 해당 옵션을 점유한 주문만 회수(주문 생성 경로), 없으면 전체.
   */
  async reclaimExpiredPendingOrders(optionIds?: number[]): Promise<void> {
    const cutoff = new Date(Date.now() - PENDING_ORDER_TTL_MS);

    const candidates: { id: string }[] =
      optionIds && optionIds.length > 0
        ? await this.dataSource.query(
            `SELECT DISTINCT o.id FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             WHERE o.status = 'PENDING' AND o.created_at < $1
               AND oi.product_option_id = ANY($2)`,
            [cutoff, optionIds],
          )
        : await this.dataSource.query(
            `SELECT id FROM orders WHERE status = 'PENDING' AND created_at < $1`,
            [cutoff],
          );

    for (const { id } of candidates) {
      const orderId = Number(id);
      const events = await this.dataSource.transaction(async (manager) => {
        const order = await manager.findOne(Order, {
          where: { id: orderId },
          lock: { mode: 'pessimistic_write' },
        });
        // 락 대기 사이에 결제 승인/취소로 상태가 바뀌었거나 TTL 안쪽이면 건너뛴다.
        if (
          !order ||
          order.status !== OrderStatus.PENDING ||
          order.createdAt >= cutoff
        ) {
          return [];
        }

        const restored = await this.restoreOrderStock(manager, orderId);
        order.status = OrderStatus.EXPIRED;
        await manager.save(order);
        return restored;
      });

      // 커밋된 재고 변경만 대시보드에 반영한다(롤백된 시도는 발행되지 않음).
      for (const event of events) {
        this.domainEvents.emitStockUpdate(event);
      }
    }
  }

  /**
   * 주문의 품목 수량만큼 재고를 되돌린다. 호출자의 트랜잭션(manager) 안에서 실행되며,
   * product_options 행을 비관적 락으로 잡아 갱신하고, 발행할 stock-update 이벤트를 반환한다
   * (SSE 발행은 커밋 이후 호출자가 담당). 만료 회수와 주문 취소(PENDING/PAID→CANCELLED)가
   * 공유한다(결정 45).
   */
  async restoreOrderStock(
    manager: EntityManager,
    orderId: number,
  ): Promise<StockUpdateEvent[]> {
    const items = await manager.find(OrderItem, {
      where: { orderId },
    });
    if (items.length === 0) return [];

    const quantityByOptionId = new Map<number, number>();
    for (const item of items) {
      quantityByOptionId.set(
        item.productOptionId,
        (quantityByOptionId.get(item.productOptionId) ?? 0) + item.quantity,
      );
    }

    // 비관적 락은 relations(JOIN) 없이 잡는다 — Postgres는 FOR UPDATE를 JOIN의 nullable
    // 쪽에 걸 수 없어서다. 상품명은 이벤트 조립용으로 별도 조회한다(createOrder와 동일 패턴).
    const options = await manager.find(ProductOption, {
      where: { id: In([...quantityByOptionId.keys()]) },
      lock: { mode: 'pessimistic_write' },
    });

    for (const option of options) {
      option.stock += quantityByOptionId.get(option.id) ?? 0;
    }
    await manager.save(options);

    const products = await manager.find(Product, {
      where: { id: In([...new Set(options.map((o) => o.productId))]) },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    return options.map((option) => ({
      productOptionId: option.id,
      productId: option.productId,
      productName: productById.get(option.productId)?.name ?? '',
      size: option.size,
      color: option.color,
      stock: option.stock,
    }));
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
        // 결제 미완료(PENDING)·만료본(EXPIRED)은 사용자에게 주문으로 노출하지 않는다
        // (결정 44/45). 상태는 DB에 남지만 조회 시에는 존재하지 않는 것처럼 404 처리한다.
        status: Not(In([...HIDDEN_ORDER_STATUSES])),
      },
    });

    if (!order) {
      throw new AppException(AppErrors.ORDER_NOT_FOUND);
    }

    return this.buildOrderLookupResponse(order);
  }

  async getMyOrders(
    userId: number,
    page = 1,
    limit = 10,
  ): Promise<PaginatedMyOrders> {
    const [orders, total] = await this.orderRepository.findAndCount({
      // 결제 미완료(PENDING)·만료본(EXPIRED)은 마이페이지 목록에서 제외한다(결정 44/45).
      where: { userId, status: Not(In([...HIDDEN_ORDER_STATUSES])) },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const items: MyOrderItem[] = orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
    }));

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  /** 다른 사용자의 주문이면 존재 여부를 노출하지 않기 위해 조회 자체를 404로 처리한다. */
  async getMyOrderDetail(
    userId: number,
    orderNumber: string,
  ): Promise<OrderLookupResponse> {
    const order = await this.orderRepository.findOne({
      // 결제 미완료(PENDING)·만료본(EXPIRED)은 상세에서도 존재 여부를 노출하지 않는다(결정 44/45).
      where: {
        orderNumber,
        userId,
        status: Not(In([...HIDDEN_ORDER_STATUSES])),
      },
    });

    if (!order) {
      throw new AppException(AppErrors.ORDER_NOT_FOUND);
    }

    return this.buildOrderLookupResponse(order);
  }

  private async buildOrderLookupResponse(
    order: Order,
  ): Promise<OrderLookupResponse> {
    const [items, deliveryEvents] = await Promise.all([
      this.orderItemRepository.find({
        where: { order: { id: order.id } },
        relations: { productOption: { product: true } },
      }),
      this.deliveryEventRepository.find({
        where: { orderId: order.id },
        order: { occurredAt: 'ASC' },
      }),
    ]);

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      buyerPhone: order.buyerPhone,
      buyerAddress: order.buyerAddress,
      postalCode: order.postalCode,
      baseAddress: order.baseAddress,
      detailAddress: order.detailAddress,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      deliveryEvents: deliveryEvents.map((event) => ({
        stage: event.stage,
        location: event.location,
        occurredAt: event.occurredAt,
      })),
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
