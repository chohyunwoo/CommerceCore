import * as http from 'http';
import type { AddressInfo } from 'net';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  CreateOrderResponse,
  OrderLookupResponse,
  PaginatedMyOrders,
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

// SSE 응답은 끝나지 않는 스트림이라 supertest의 .expect()(응답 종료까지 대기)를
// 그대로 쓰면 테스트가 멈춘다. 응답 헤더(상태 코드)만 받고 바로 destroy한다.
function fetchSseStatus(port: number, ticket: string): Promise<number> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: '127.0.0.1',
        port,
        path: `/admin/events?ticket=${encodeURIComponent(ticket)}`,
      },
      (res) => {
        resolve(res.statusCode ?? 0);
        req.destroy();
      },
    );
    req.on('error', () => {
      // 응답을 받은 뒤 강제로 destroy()하면 소켓 에러 이벤트가 날 수 있어 무시한다.
    });
  });
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
  const buyerEmail = 'e2e-lifecycle@example.com';
  const adminEmail = 'e2e-lifecycle-admin@example.com';

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
    await dataSource.query(`DELETE FROM users WHERE email = $1`, [adminEmail]);
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

    // 정적 토큰(결정 16) 대신 role='admin' 세션으로 관리자 API를 호출한다(결정 38).
    // role 승격은 실제 운영에서도 로그인 후 DB를 직접 수동으로 바꾸는 방식이라
    // (코드/마이그레이션에 계정 정보를 남기지 않음) 테스트도 동일한 절차를 재현한다.
    await request(server)
      .post('/auth/register')
      .send({ email: adminEmail, password: 'password1234', name: '관리자' })
      .expect(201);
    await dataSource.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [
      adminEmail,
    ]);
    const adminLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: adminEmail, password: 'password1234' })
      .expect(201);
    const adminToken = (adminLoginRes.body as AuthResponse).token;

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
      .set('X-Session-Token', adminToken)
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
        .set('X-Session-Token', adminToken)
        .send({ stage })
        .expect(201);
      lastStageBody = stageRes.body as RecentOrderItem;
    }
    expect(lastStageBody!.status).toBe('DELIVERED');
    expect(lastStageBody!.deliveryEvents).toHaveLength(4);

    // 단계 순서를 벗어난 재기록은 거부된다.
    await request(server)
      .post(`/admin/orders/${orderNumber}/delivery-events`)
      .set('X-Session-Token', adminToken)
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
 * 관리자 API의 role 기반 접근 제어를 실제 AppModule(진짜 DB/Redis)로 검증한다 —
 * 이슈 #69. 정적 공유 토큰(결정 16)을 role='admin' 세션으로 교체했으므로, 세션이
 * 없거나 role이 'user'인 계정은 401로 거부되는 것과, SSE 티켓이 admin에게만
 * 발급되고 1회용으로만 쓰이는 것까지 함께 확인한다(결정 38).
 */
describe('관리자 API 접근 제어 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const userEmail = 'e2e-rbac-user@example.com';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await dataSource.query(`DELETE FROM users WHERE email = $1`, [userEmail]);
    await app.close();
  });

  it('세션 없이 관리자 API를 호출하면 401', async () => {
    const server = app.getHttpServer();

    await request(server).get('/admin/stock-overview').expect(401);
  });

  it('로그인했지만 role이 admin이 아니면 401', async () => {
    const server = app.getHttpServer();

    const registerRes = await request(server)
      .post('/auth/register')
      .send({ email: userEmail, password: 'password1234', name: '일반유저' })
      .expect(201);
    const { token } = registerRes.body as AuthResponse;

    await request(server)
      .get('/admin/stock-overview')
      .set('X-Session-Token', token)
      .expect(401);

    // SSE 티켓 발급도 마찬가지로 거부된다.
    await request(server)
      .post('/admin/events/ticket')
      .set('X-Session-Token', token)
      .expect(401);
  });

  it('admin 세션으로 발급받은 SSE 티켓은 1회만 사용할 수 있다', async () => {
    const server = app.getHttpServer() as http.Server;

    await request(server)
      .post('/auth/register')
      .send({ email: userEmail, password: 'password1234', name: '관리자후보' })
      .expect(201);
    await dataSource.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [
      userEmail,
    ]);
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: userEmail, password: 'password1234' })
      .expect(201);
    const { token } = loginRes.body as AuthResponse;

    const ticketRes = await request(server)
      .post('/admin/events/ticket')
      .set('X-Session-Token', token)
      .expect(201);
    const { ticket } = ticketRes.body as { ticket: string };
    expect(ticket).toBeTruthy();

    // supertest는 요청마다 임시 포트에 리슨했다가 응답 후 바로 닫으므로, SSE(스트림이
    // 끝나지 않는) 요청은 별도로 직접 리슨해 포트를 확보해야 한다.
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      expect(await fetchSseStatus(port, ticket)).toBe(200);

      // 같은 티켓 재사용은 거부된다.
      expect(await fetchSseStatus(port, ticket)).toBe(401);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
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

/**
 * 로그인 사용자의 주문-계정 연결과 마이페이지(목록/상세)를 실제 AppModule(진짜
 * DB/Redis)로 검증한다 — 이슈 #67. 다른 사용자의 주문을 상세 조회하면 존재
 * 여부를 노출하지 않기 위해 404가 나는 것까지 함께 확인한다.
 */
describe('주문-계정 연결 + 마이페이지 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let categoryId: number;
  let productId: number;
  let productOptionId: number;
  const emailA = 'e2e-mypage-a@example.com';
  const emailB = 'e2e-mypage-b@example.com';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    const [category] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
      ['E2E마이페이지카테고리'],
    );
    categoryId = Number(category.id);

    const [product] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO products (category_id, name, base_price) VALUES ($1, $2, $3) RETURNING id`,
      [categoryId, 'E2E마이페이지상품', 10000],
    );
    productId = Number(product.id);

    const [option] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO product_options (product_id, size, color, stock, sku) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [productId, 'M', '블랙', 50, `E2E-MYPAGE-SKU-${Date.now()}`],
    );
    productOptionId = Number(option.id);
  });

  afterEach(async () => {
    await dataSource.query(
      `DELETE FROM order_items WHERE product_option_id = $1`,
      [productOptionId],
    );
    await dataSource.query(`DELETE FROM orders WHERE buyer_email IN ($1, $2)`, [
      emailA,
      emailB,
    ]);
    await dataSource.query(`DELETE FROM users WHERE email IN ($1, $2)`, [
      emailA,
      emailB,
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

  it('로그인 상태로 주문하면 마이페이지 목록/상세에 나타나고, 다른 사용자는 404를 받는다', async () => {
    const server = app.getHttpServer();

    const registerARes = await request(server)
      .post('/auth/register')
      .send({ email: emailA, password: 'password1234', name: '구매자A' })
      .expect(201);
    const { token: tokenA } = registerARes.body as AuthResponse;

    const createRes = await request(server)
      .post('/orders')
      .set('X-Cart-Id', 'e2e-mypage-cart-a')
      .set('X-Session-Token', tokenA)
      .send({
        buyerEmail: emailA,
        buyerName: '구매자A',
        buyerPhone: '010-1234-5678',
        postalCode: '06236',
        baseAddress: '서울시 강남구 테헤란로 123',
        items: [{ productOptionId, quantity: 1 }],
      })
      .expect(201);
    const { orderNumber } = createRes.body as CreateOrderResponse;

    const myOrdersRes = await request(server)
      .get('/orders/my')
      .set('X-Session-Token', tokenA)
      .expect(200);
    const myOrdersBody = myOrdersRes.body as PaginatedMyOrders;
    expect(myOrdersBody.items).toHaveLength(1);
    expect(myOrdersBody.items[0].orderNumber).toBe(orderNumber);

    const myOrderDetailRes = await request(server)
      .get(`/orders/my/${orderNumber}`)
      .set('X-Session-Token', tokenA)
      .expect(200);
    const detailBody = myOrderDetailRes.body as OrderLookupResponse;
    expect(detailBody.orderNumber).toBe(orderNumber);
    expect(detailBody.items).toHaveLength(1);

    // 세션 없이는 401.
    await request(server).get('/orders/my').expect(401);

    // 다른 사용자로는 목록에 안 보이고, 상세 조회는 404(존재 여부 비노출).
    const registerBRes = await request(server)
      .post('/auth/register')
      .send({ email: emailB, password: 'password1234', name: '구매자B' })
      .expect(201);
    const { token: tokenB } = registerBRes.body as AuthResponse;

    const otherMyOrdersRes = await request(server)
      .get('/orders/my')
      .set('X-Session-Token', tokenB)
      .expect(200);
    expect((otherMyOrdersRes.body as PaginatedMyOrders).items).toHaveLength(0);

    await request(server)
      .get(`/orders/my/${orderNumber}`)
      .set('X-Session-Token', tokenB)
      .expect(404);
  });
});
