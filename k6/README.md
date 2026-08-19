# k6 부하테스트

## order-concurrency.js

**목적**: 결정 2(비관적 락)가 실제로 재고 초과 판매를 막는지 검증. (결정 13)

**검증 방식**: 재고 1개인 상품 옵션(`productOptionId: 1`, 테스트 데이터)에 10개 VU가 동시에 `POST /orders`로 수량 1씩 주문 요청.

**실행**:

```bash
docker compose up -d
cd backend && npm run start
k6 run k6/order-concurrency.js
```

환경변수로 대상 옵션/동시 요청 수 조정 가능: `BASE_URL`, `PRODUCT_OPTION_ID`, `VUS`.

**실행 결과 (2026-08-14)**:

- 요청 10건 중 성공(201) 1건 / 재고 부족(409) 9건
- 실행 후 `product_options.stock` = 0 (초과 판매 없음)
- `orders` 테이블에 정확히 1건 생성 확인

```
checks_succeeded...: 100.00% 10 out of 10
orders_created.....: 1
orders_conflicted..: 9
```

재고 1개 옵션은 동시성 테스트 전용이라, 이 스크립트를 다시 실행하려면 먼저 해당 옵션의 재고를 1로 복구해야 함.

## throughput-test.js

**목적**: 결정 31(P2-1 성능 병목 진단)에서 다룬 `/orders/lookup`(캐싱·락 없는 순수 조회)의 처리량 회귀를 pass/fail로 자동 판정. `diagnostic-throughput.js`(일회성 진단용)를 대체하는 정식 스크립트.

**thresholds**: `http_req_duration` p(95) < 300ms, 서버 오류율(`errors`, 5xx·예기치 않은 상태 코드) < 1%. 404(주문 없음)는 정상 응답으로 간주해 오류율 집계에서 제외.

**실행**:

```bash
k6 run k6/throughput-test.js
k6 run -e VUS=20 -e DURATION=30s k6/throughput-test.js
```

환경변수: `BASE_URL`, `VUS`(기본 10), `DURATION`(기본 30s).

**주의**: 결정 31 기준 개선 후에도 VU30 부하에서 p95가 약 1.05s로 측정됨 — 300ms 기준은 VU10 수준 부하를 겨냥한 목표치이며, VU를 올리면 현재 구현으로는 이 threshold를 통과하지 못할 수 있음. 이는 스크립트 결함이 아니라 남은 최적화 여지를 드러내는 신호로 의도된 것.
