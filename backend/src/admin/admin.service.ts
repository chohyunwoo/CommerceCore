import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { adminSseTicketKey } from '../common/session/admin-sse-ticket.util';
import { ProductOption } from '../products/entities/product-option.entity';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order-status.enum';
import { Carrier } from '../orders/entities/carrier.enum';
import { DeliveryEvent } from '../orders/entities/delivery-event.entity';
import { DELIVERY_STAGE_ORDER } from '../orders/entities/delivery-stage.enum';
import { DomainEventsService } from '../common/events/domain-events.service';
import { PaymentsService } from '../payments/payments.service';
import {
  AdminStats,
  CategoryItem,
  PaginatedRecentOrders,
  RecentOrderItem,
  StockOverviewItem,
} from './admin.types';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateDeliveryEventDto } from './dto/create-delivery-event.dto';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

const RECENT_ORDERS_LIMIT = 20;
const CANCEL_REASON = '관리자에 의한 주문 취소';
const ADMIN_SSE_TICKET_TTL_SECONDS = 30;

// 매출로 집계하는 주문 상태 — 결제가 확정된 것만(대기/취소 제외). 결정 42.
const REVENUE_STATUSES: string[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

// SHIPPED → DELIVERED는 이 메서드로 직접 전이하지 않는다 — 배송 단계 타임라인의
// 마지막 이벤트(DELIVERED)가 기록될 때 addDeliveryEvent()가 자동으로 전이시킨다.
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [],
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
    @InjectRepository(DeliveryEvent)
    private readonly deliveryEventRepository: Repository<DeliveryEvent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly domainEvents: DomainEventsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * EventSource가 커스텀 헤더를 못 보내 세션 토큰을 URL에 그대로 실어야 했던
   * 문제를 해소하기 위한 1회용 단기 티켓 발급(결정 38). 이 메서드 자체는
   * AdminGuard(세션+role 검증)로 보호되므로, 티켓 발급 시점엔 이미 관리자임이
   * 확인된 상태다.
   */
  async issueSseTicket(): Promise<{ ticket: string }> {
    const ticket = randomUUID();
    await this.redis.set(
      adminSseTicketKey(ticket),
      '1',
      'EX',
      ADMIN_SSE_TICKET_TTL_SECONDS,
    );
    return { ticket };
  }

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
      relations: { product: { category: true } },
      order: { product: { categoryId: 'ASC' }, id: 'ASC' },
    });

    return options.map((option) => ({
      productOptionId: option.id,
      productName: option.product.name,
      categoryName: option.product.category.name,
      size: option.size,
      color: option.color,
      stock: option.stock,
    }));
  }

  /**
   * 대시보드 통계 집계(결정 42). 전 행을 앱으로 로드하지 않고 Postgres GROUP BY/집계로
   * 계산한다(Render 0.1 vCPU, 결정 31). 매출은 REVENUE_STATUSES(PAID·SHIPPED·DELIVERED)만
   * 포함하고, 주문 상태 분포는 전체 상태를 센다. 시계열은 generate_series로 빈 구간도 0으로 채운다.
   */
  async getStats(): Promise<AdminStats> {
    const summaryRows = await this.dataSource.query<
      { revenue: string; orders: string }[]
    >(
      `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS orders
       FROM orders WHERE status::text = ANY($1)`,
      [REVENUE_STATUSES],
    );

    const unitsRows = await this.dataSource.query<{ units: string }[]>(
      `SELECT COALESCE(SUM(oi.quantity), 0) AS units
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status::text = ANY($1)`,
      [REVENUE_STATUSES],
    );

    const revenueDaily = await this.dataSource.query<
      { date: string; revenue: string }[]
    >(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
              COALESCE(SUM(o.total_amount), 0) AS revenue
       FROM generate_series(
         date_trunc('day', CURRENT_DATE) - INTERVAL '29 days',
         date_trunc('day', CURRENT_DATE),
         INTERVAL '1 day'
       ) d(day)
       LEFT JOIN orders o
         ON date_trunc('day', o.created_at) = d.day
         AND o.status::text = ANY($1)
       GROUP BY d.day ORDER BY d.day`,
      [REVENUE_STATUSES],
    );

    const revenueMonthly = await this.dataSource.query<
      { month: string; revenue: string }[]
    >(
      `SELECT to_char(m.month, 'YYYY-MM') AS month,
              COALESCE(SUM(o.total_amount), 0) AS revenue
       FROM generate_series(
         date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
         date_trunc('month', CURRENT_DATE),
         INTERVAL '1 month'
       ) m(month)
       LEFT JOIN orders o
         ON date_trunc('month', o.created_at) = m.month
         AND o.status::text = ANY($1)
       GROUP BY m.month ORDER BY m.month`,
      [REVENUE_STATUSES],
    );

    const categoryRevenue = await this.dataSource.query<
      { categoryName: string; revenue: string }[]
    >(
      `SELECT c.name AS "categoryName",
              COALESCE(SUM(oi.price_at_order * oi.quantity), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN product_options po ON po.id = oi.product_option_id
       JOIN products p ON p.id = po.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE o.status::text = ANY($1)
       GROUP BY c.name ORDER BY revenue DESC`,
      [REVENUE_STATUSES],
    );

    const topProducts = await this.dataSource.query<
      { productName: string; revenue: string }[]
    >(
      `SELECT p.name AS "productName",
              COALESCE(SUM(oi.price_at_order * oi.quantity), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN product_options po ON po.id = oi.product_option_id
       JOIN products p ON p.id = po.product_id
       WHERE o.status::text = ANY($1)
       GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 5`,
      [REVENUE_STATUSES],
    );

    const orderStatusDistribution = await this.dataSource.query<
      { status: string; count: string }[]
    >(
      `SELECT status::text AS status, COUNT(*) AS count
       FROM orders GROUP BY status ORDER BY status`,
    );

    return {
      summary: {
        totalRevenue: Number(summaryRows[0]?.revenue ?? 0),
        totalOrders: Number(summaryRows[0]?.orders ?? 0),
        totalUnits: Number(unitsRows[0]?.units ?? 0),
      },
      revenueDaily: revenueDaily.map((r) => ({
        date: r.date,
        revenue: Number(r.revenue),
      })),
      revenueMonthly: revenueMonthly.map((r) => ({
        month: r.month,
        revenue: Number(r.revenue),
      })),
      categoryRevenue: categoryRevenue.map((r) => ({
        categoryName: r.categoryName,
        revenue: Number(r.revenue),
      })),
      topProducts: topProducts.map((r) => ({
        productName: r.productName,
        revenue: Number(r.revenue),
      })),
      orderStatusDistribution: orderStatusDistribution.map((r) => ({
        status: r.status,
        count: Number(r.count),
      })),
    };
  }

  async updateOrderStatus(
    orderNumber: string,
    newStatus: OrderStatus,
    trackingNumber?: string,
    carrier?: Carrier,
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

      if (newStatus === OrderStatus.SHIPPED) {
        order.trackingNumber = trackingNumber ?? null;
        order.carrier = carrier ?? null;
      }

      order.status = newStatus;
      return manager.save(order);
    });

    const updated = this.toRecentOrderItem(order, []);

    this.domainEvents.emitOrderUpdate(updated);
    return updated;
  }

  /**
   * 배송 단계를 하나씩 기록한다. COLLECTED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
   * 순서를 벗어나면 거부한다. 마지막 단계(DELIVERED) 기록 시 주문 status도 함께 전이한다
   * (status와 이벤트 타임라인이 따로 놀지 않도록 — SHIPPED → DELIVERED는 이 경로로만 일어남).
   */
  async addDeliveryEvent(
    orderNumber: string,
    dto: CreateDeliveryEventDto,
  ): Promise<RecentOrderItem> {
    const { order, events } = await this.dataSource.transaction(
      async (manager) => {
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
        if (order.status !== OrderStatus.SHIPPED) {
          throw new AppException(AppErrors.DELIVERY_EVENT_ORDER_NOT_SHIPPED);
        }

        const existingEvents = await manager.find(DeliveryEvent, {
          where: { orderId: order.id },
          order: { occurredAt: 'ASC' },
        });

        const expectedStage = DELIVERY_STAGE_ORDER[existingEvents.length];
        if (!expectedStage || expectedStage !== dto.stage) {
          throw new AppException(AppErrors.DELIVERY_STAGE_ORDER_INVALID);
        }

        const newEvent = await manager.save(
          manager.create(DeliveryEvent, {
            orderId: order.id,
            stage: dto.stage,
            location: dto.location ?? null,
            occurredAt: new Date(),
          }),
        );

        if (
          dto.stage === DELIVERY_STAGE_ORDER[DELIVERY_STAGE_ORDER.length - 1]
        ) {
          order.status = OrderStatus.DELIVERED;
          await manager.save(order);
        }

        return { order, events: [...existingEvents, newEvent] };
      },
    );

    const updated = this.toRecentOrderItem(order, events);

    this.domainEvents.emitOrderUpdate(updated);
    return updated;
  }

  async getRecentOrders(
    status?: OrderStatus,
    page = 1,
    limit = RECENT_ORDERS_LIMIT,
    search?: string,
  ): Promise<PaginatedRecentOrders> {
    const trimmedSearch = search?.trim();
    const baseWhere = status ? { status } : {};
    // 이름/이메일 중 하나만 일치해도 찾을 수 있어야 하므로 OR — TypeORM에서는
    // where에 배열을 넘기면 각 원소가 OR로 묶인다(각 원소 내부는 AND).
    const where = trimmedSearch
      ? [
          { ...baseWhere, buyerName: ILike(`%${trimmedSearch}%`) },
          { ...baseWhere, buyerEmail: ILike(`%${trimmedSearch}%`) },
        ]
      : status
        ? baseWhere
        : undefined;

    const [orders, total] = await this.orderRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const orderIds = orders.map((order) => order.id);
    const events = orderIds.length
      ? await this.deliveryEventRepository.find({
          where: { orderId: In(orderIds) },
          order: { occurredAt: 'ASC' },
        })
      : [];

    const eventsByOrderId = new Map<number, DeliveryEvent[]>();
    for (const event of events) {
      const list = eventsByOrderId.get(event.orderId) ?? [];
      list.push(event);
      eventsByOrderId.set(event.orderId, list);
    }

    return {
      items: orders.map((order) =>
        this.toRecentOrderItem(order, eventsByOrderId.get(order.id) ?? []),
      ),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  private toRecentOrderItem(
    order: Order,
    events: DeliveryEvent[],
  ): RecentOrderItem {
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      buyerName: order.buyerName,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      trackingNumber: order.trackingNumber ?? null,
      carrier: order.carrier ?? null,
      deliveryEvents: events.map((event) => ({
        stage: event.stage,
        location: event.location,
        occurredAt: event.occurredAt,
      })),
    };
  }
}
