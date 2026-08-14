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
