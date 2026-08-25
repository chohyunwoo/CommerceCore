import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const PRODUCT_OPTION_ID = Number(__ENV.PRODUCT_OPTION_ID || 1);
const VUS = Number(__ENV.VUS || 10);

export const options = {
  scenarios: {
    concurrent_orders: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: '30s',
    },
  },
};

const created = new Counter('orders_created');
const conflicted = new Counter('orders_conflicted');

export default function () {
  const payload = JSON.stringify({
    buyerEmail: `k6-vu${__VU}@example.com`,
    buyerName: `k6 tester ${__VU}`,
    // 구조화 주소(이슈 #52)·전화번호 정규화(이슈 #53) 도입 이후 형식에 맞춰 갱신.
    buyerPhone: '010-1234-5678',
    postalCode: '06236',
    baseAddress: '서울시 강남구 테헤란로 123',
    items: [{ productOptionId: PRODUCT_OPTION_ID, quantity: 1 }],
  });

  const res = http.post(`${BASE_URL}/orders`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Cart-Id': `k6-cart-vu${__VU}`,
    },
  });

  if (res.status === 201) created.add(1);
  if (res.status === 409) conflicted.add(1);

  check(res, {
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
  });
}
