import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  CreateOrderResponse,
  OrderLookupResponse,
  ValidateStockResponse,
} from '../src/orders/orders.types';
import { RecentOrderItem } from '../src/admin/admin.types';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 300, status, json: () => Promise.resolve(body) };
}

/**
 * 주문~배송완료 전체 흐름을 실제 AppModule(진짜 DB/Redis)로 검증한다 — 이슈 #59.
 * TossPayments만 fetch를 mock한다(승인 API를 실제로 호출할 수 없으므로, 결정 25/26과
 * 동일한 방식). 이 테스트가 통과한다는 것은 상태 머신(PENDING→PAID→SHIPPED)과
 * 배송 단계 타임라인(COLLECTED→...→DELIVERED)이 끝까지 이어져 동작한다는 근거가 된다.
 */
describe('주문 → 배송완료 전체 라이프사이클 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let categoryId: number;
  let productId: number;
  let productOptionId: number;
  const originalFetch = global.fetch;
  const adminToken = process.env.ADMIN_TOKEN ?? 'ci_admin_token';
  const buyerEmail = 'e2e-lifecycle@example.com';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    // BIGSERIAL 컬럼이라 pg 드라이버가 RETURNING id를 문자열로 반환한다 — 이후 요청
    // 바디에 그대로 실어 보내면 안 되므로 숫자로 변환해둔다.
    const [category] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
      ['E2E테스트카테고리'],
    );
    categoryId = Number(category.id);

    const [product] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO products (category_id, name, base_price) VALUES ($1, $2, $3) RETURNING id`,
      [categoryId, 'E2E테스트상품', 10000],
    );
    productId = Number(product.id);

    const [option] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO product_options (product_id, size, color, stock, sku) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [productId, 'M', '블랙', 10, `E2E-SKU-${Date.now()}`],
    );
    productOptionId = Number(option.id);
  });

  afterEach(async () => {
    global.fetch = originalFetch;

    await dataSource.query(
      `DELETE FROM delivery_events WHERE order_id IN (SELECT id FROM orders WHERE buyer_email = $1)`,
      [buyerEmail],
    );
    await dataSource.query(
      `DELETE FROM order_items WHERE product_option_id = $1`,
      [productOptionId],
    );
    await dataSource.query(`DELETE FROM orders WHERE buyer_email = $1`, [
      buyerEmail,
    ]);
    await dataSource.query(`DELETE FROM product_options WHERE id = $1`, [
      productOptionId,
    ]);
    await dataSource.query(`DELETE FROM products WHERE id = $1`, [productId]);
    await dataSource.query(`DELETE FROM categories WHERE id = $1`, [
      categoryId,
    ]);

    await app.close();
  });

  it('주문 생성부터 배송완료까지 상태·배송 단계가 끝까지 이어진다', async () => {
    const server = app.getHttpServer();
    const cartId = 'e2e-lifecycle-cart';

    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, {}));

    const validateRes = await request(server)
      .post('/orders/validate-stock')
      .send({ items: [{ productOptionId, quantity: 1 }] })
      .expect(200);
    expect((validateRes.body as ValidateStockResponse).valid).toBe(true);

    const createRes = await request(server)
      .post('/orders')
      .set('X-Cart-Id', cartId)
      .send({
        buyerEmail,
        buyerName: '테스트구매자',
        buyerPhone: '010-1234-5678',
        postalCode: '06236',
        baseAddress: '서울시 강남구 테헤란로 123',
        items: [{ productOptionId, quantity: 1 }],
      })
      .expect(201);

    const createBody = createRes.body as CreateOrderResponse;
    const orderNumber = createBody.orderNumber;
    expect(createBody.status).toBe('PENDING');

    const confirmRes = await request(server)
      .post('/payments/confirm')
      .send({
        paymentKey: 'e2e-payment-key',
        orderId: orderNumber,
        amount: 10000,
      })
      .expect(201);
    expect((confirmRes.body as { status: string }).status).toBe('PAID');

    const shipRes = await request(server)
      .patch(`/admin/orders/${orderNumber}/status`)
      .set('X-Admin-Token', adminToken)
      .send({
        status: 'SHIPPED',
        trackingNumber: '1234567890',
        carrier: 'CJ대한통운',
      })
      .expect(200);
    const shipBody = shipRes.body as RecentOrderItem;
    expect(shipBody.status).toBe('SHIPPED');
    expect(shipBody.trackingNumber).toBe('1234567890');

    const stages = ['COLLECTED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    let lastStageBody: RecentOrderItem | undefined;
    for (const stage of stages) {
      const stageRes = await request(server)
        .post(`/admin/orders/${orderNumber}/delivery-events`)
        .set('X-Admin-Token', adminToken)
        .send({ stage })
        .expect(201);
      lastStageBody = stageRes.body as RecentOrderItem;
    }
    expect(lastStageBody!.status).toBe('DELIVERED');
    expect(lastStageBody!.deliveryEvents).toHaveLength(4);

    // 단계 순서를 벗어난 재기록은 거부된다.
    await request(server)
      .post(`/admin/orders/${orderNumber}/delivery-events`)
      .set('X-Admin-Token', adminToken)
      .send({ stage: 'COLLECTED' })
      .expect(400);

    const lookupRes = await request(server)
      .get(`/orders/lookup?orderNumber=${orderNumber}&email=${buyerEmail}`)
      .expect(200);
    const lookupBody = lookupRes.body as OrderLookupResponse;
    expect(lookupBody.status).toBe('DELIVERED');
    expect(lookupBody.trackingNumber).toBe('1234567890');
    expect(lookupBody.carrier).toBe('CJ대한통운');
    expect(lookupBody.deliveryEvents).toHaveLength(4);
  });
});
