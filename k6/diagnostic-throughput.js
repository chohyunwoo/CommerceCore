import http from 'k6/http';
import { check } from 'k6';

// 진단용 스크립트 — 병목 지점을 찾기 위한 일회성 측정. 정식 스크립트가 아님.
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const VUS = Number(__ENV.VUS || 10);

export const options = {
  scenarios: {
    probe: {
      executor: 'constant-vus',
      vus: VUS,
      duration: '15s',
    },
  },
};

export default function () {
  const res = http.get(
    `${BASE_URL}/orders/lookup?orderNumber=ORD-PROBE-${__VU}-${__ITER}&email=probe@example.com`,
  );
  check(res, { 'status is 404 (expected miss)': (r) => r.status === 404 });
}
