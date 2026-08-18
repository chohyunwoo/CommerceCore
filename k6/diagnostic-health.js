import http from 'k6/http';
import { check } from 'k6';

// 진단용 — /orders/lookup(무거운 JOIN)과 비교하기 위한 가벼운 엔드포인트 테스트.
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
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'status is 200': (r) => r.status === 200 });
}
