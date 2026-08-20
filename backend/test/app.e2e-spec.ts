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
import { AuthResponse, CurrentUser } from '../src/auth/auth.types';
import { CartResponse } from '../src/cart/cart.types';

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

/**
 * 회원가입~로그아웃 전체 흐름을 실제 AppModule(진짜 DB/Redis)로 검증한다 — 이슈 #63.
 * 로그아웃 이후 같은 토큰으로 /auth/me를 호출하면 세션이 즉시 무효화되어 401이
 * 나는 것까지 확인해, "로그아웃이 실제로 서버 상태를 지운다"는 설계를 방어한다.
 */
describe('회원가입~로그아웃 라이프사이클 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const testEmail = 'e2e-auth@example.com';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await dataSource.query(`DELETE FROM users WHERE email = $1`, [testEmail]);
    await app.close();
  });

  it('회원가입 → 로그인 → /me → 로그아웃 → /me(401)까지 이어진다', async () => {
    const server = app.getHttpServer();

    const registerRes = await request(server)
      .post('/auth/register')
      .send({ email: testEmail, password: 'password1234', name: '테스트유저' })
      .expect(201);
    const registerBody = registerRes.body as AuthResponse;
    expect(registerBody.user.email).toBe(testEmail);
    expect(registerBody.token).toBeTruthy();

    // 중복 가입은 거부된다.
    await request(server)
      .post('/auth/register')
      .send({ email: testEmail, password: 'password1234', name: '테스트유저' })
      .expect(409);

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: testEmail, password: 'password1234' })
      .expect(201);
    const { token } = loginRes.body as AuthResponse;

    // 틀린 비밀번호는 거부된다.
    await request(server)
      .post('/auth/login')
      .send({ email: testEmail, password: 'wrong-password' })
      .expect(401);

    const meRes = await request(server)
      .get('/auth/me')
      .set('X-Session-Token', token)
      .expect(200);
    const meBody = meRes.body as CurrentUser;
    expect(meBody.email).toBe(testEmail);
    expect(meBody.name).toBe('테스트유저');

    // 세션 토큰 없이는 401.
    await request(server).get('/auth/me').expect(401);

    await request(server)
      .post('/auth/logout')
      .set('X-Session-Token', token)
      .expect(201);

    // 로그아웃 이후 같은 토큰은 즉시 무효화된다.
    await request(server)
      .get('/auth/me')
      .set('X-Session-Token', token)
      .expect(401);
  });
});

/**
 * 게스트 장바구니 → 로그인 사용자 장바구니 병합을 실제 AppModule(진짜 DB/Redis)로
 * 검증한다 — 이슈 #65. 회원가입 시점(빈 DB 카트 + 게스트 항목 병합)과 로그인
 * 시점(기존 DB 카트 + 게스트 항목 합산) 두 경로 모두 확인한다.
 */
describe('게스트 장바구니 → 로그인 사용자 장바구니 병합 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let categoryId: number;
  let productId: number;
  let productOptionId: number;
  const testEmail = 'e2e-cart-merge@example.com';
  const cartId1 = 'e2e-cart-merge-guest-1';
  const cartId2 = 'e2e-cart-merge-guest-2';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    const [category] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
      ['E2E카트병합카테고리'],
    );
    categoryId = Number(category.id);

    const [product] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO products (category_id, name, base_price) VALUES ($1, $2, $3) RETURNING id`,
      [categoryId, 'E2E카트병합상품', 10000],
    );
    productId = Number(product.id);

    const [option] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO product_options (product_id, size, color, stock, sku) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [productId, 'M', '블랙', 50, `E2E-CART-MERGE-SKU-${Date.now()}`],
    );
    productOptionId = Number(option.id);
  });

  afterEach(async () => {
    await dataSource.query(
      `DELETE FROM cart_items WHERE product_option_id = $1`,
      [productOptionId],
    );
    await dataSource.query(`DELETE FROM users WHERE email = $1`, [testEmail]);
    await dataSource.query(`DELETE FROM product_options WHERE id = $1`, [
      productOptionId,
    ]);
    await dataSource.query(`DELETE FROM products WHERE id = $1`, [productId]);
    await dataSource.query(`DELETE FROM categories WHERE id = $1`, [
      categoryId,
    ]);

    await app.close();
  });

  it('회원가입 시 게스트 장바구니가 그대로 로그인 사용자 장바구니로 반영된다', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/cart/items')
      .set('X-Cart-Id', cartId1)
      .send({ productOptionId, quantity: 2 })
      .expect(201);

    const registerRes = await request(server)
      .post('/auth/register')
      .set('X-Cart-Id', cartId1)
      .send({ email: testEmail, password: 'password1234', name: '카트테스트' })
      .expect(201);
    const { token } = registerRes.body as AuthResponse;

    const cartRes = await request(server)
      .get('/cart')
      .set('X-Cart-Id', cartId1)
      .set('X-Session-Token', token)
      .expect(200);
    const cartBody = cartRes.body as CartResponse;
    expect(cartBody.items).toHaveLength(1);
    expect(cartBody.items[0].productOptionId).toBe(productOptionId);
    expect(cartBody.items[0].quantity).toBe(2);

    // 병합 후 게스트 장바구니(Redis)는 비워진다.
    const guestCartRes = await request(server)
      .get('/cart')
      .set('X-Cart-Id', cartId1)
      .expect(200);
    expect((guestCartRes.body as CartResponse).items).toHaveLength(0);
  });

  it('로그인 시 게스트 장바구니 수량이 기존 장바구니 수량에 합산된다', async () => {
    const server = app.getHttpServer();

    // 최초 회원가입으로 DB 장바구니에 수량 2 확보.
    await request(server)
      .post('/cart/items')
      .set('X-Cart-Id', cartId1)
      .send({ productOptionId, quantity: 2 })
      .expect(201);
    await request(server)
      .post('/auth/register')
      .set('X-Cart-Id', cartId1)
      .send({ email: testEmail, password: 'password1234', name: '카트테스트' })
      .expect(201);

    // 로그아웃 상태에서 다른 게스트 장바구니에 수량 3 추가 후 로그인.
    await request(server)
      .post('/cart/items')
      .set('X-Cart-Id', cartId2)
      .send({ productOptionId, quantity: 3 })
      .expect(201);

    const loginRes = await request(server)
      .post('/auth/login')
      .set('X-Cart-Id', cartId2)
      .send({ email: testEmail, password: 'password1234' })
      .expect(201);
    const { token } = loginRes.body as AuthResponse;

    // X-Cart-Id는 로그인 사용자 경로에서는 실제로 쓰이지 않지만, 모든 장바구니
    // 요청에 공통으로 요구되는 헤더라 그대로 실어 보낸다.
    const cartRes = await request(server)
      .get('/cart')
      .set('X-Cart-Id', cartId2)
      .set('X-Session-Token', token)
      .expect(200);
    const cartBody = cartRes.body as CartResponse;
    expect(cartBody.items).toHaveLength(1);
    expect(cartBody.items[0].quantity).toBe(5);
  });
});
