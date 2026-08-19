import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

// 정식 처리량 검증 스크립트 — 결정 31(P2-1 성능 병목 진단)에서 확인한
// `/orders/lookup`(캐싱·락 없는 순수 조회) 경로를 대상으로 pass/fail을 자동 판정한다.
// diagnostic-throughput.js와 달리 일회성 진단이 아니라 회귀 감지용으로 반복 실행하는 것을 전제로 함.
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || '30s';

export const options = {
  scenarios: {
    throughput: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<300'],
    'errors': ['rate<0.01'],
  },
};

// 존재하지 않는 조합으로 항상 404(정상 응답)를 유도 — 서버 오류(5xx)나 예기치 않은 상태 코드만 실패로 집계.
const errorRate = new Rate('errors');

export default function () {
  const res = http.get(
    `${BASE_URL}/orders/lookup?orderNumber=ORD-THROUGHPUT-${__VU}-${__ITER}&email=throughput@example.com`,
  );

  const ok = res.status === 200 || res.status === 404;
  errorRate.add(!ok);

  check(res, { 'status is 200 or 404 (not a server error)': () => ok });
}
