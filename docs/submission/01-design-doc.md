# 설계 문서 — Commerce Core 백엔드

## 1. 문제 정의와 사용자

### 문제
소규모 패션 커머스(신발·상의·하의)를 **로그인 없이도 쓸 수 있게** 열되, 두 가지를 놓치지 않아야 한다.

1. **재고 정확성**: 재고가 적은 인기 옵션에 주문이 몰릴 때 **초과 판매(oversell)가 절대 없어야** 한다. 커머스에서 재고 오류는 곧 환불·CS·신뢰 손실이다.
2. **상품 탐색의 한계**: "이거랑 비슷한 옷 없나?"를 키워드로 표현하기 어렵다. 텍스트 검색만으로는 시각적으로 비슷한 상품을 찾지 못한다.

### 사용자
- **게스트 구매자**(주 사용자): 회원가입 없이 상품을 탐색·주문하고, 주문번호+이메일로 배송을 조회한다.
- **로그인 사용자**: 장바구니·주문이 계정에 영구 보관되고 마이페이지에서 배송을 추적한다.
- **운영자(admin)**: 재고·주문·배송을 처리하고 매출·판매 통계를 본다.

### 성공 지표(사전 정의)
| 축 | 지표 | 목표 |
|---|---|---|
| 정확성 | 동시 주문 시 초과 판매 건수 | **0건** (재고보다 많이 팔리지 않음) |
| 성능 | `GET /orders/lookup` p95 / 처리량 | 병목 개선 전 대비 유의미한 향상 |
| 안정성 | 이상 입력·실패·중복 요청 방어 | 5xx·데이터 오염 없이 정상 분기 |
| 신뢰성 | 자동 테스트 | 유닛+e2e가 회귀를 잡음 |

> 이 프로젝트는 "완제품 커머스"가 아니라 **주문·재고 정합성이라는 한 줄기를 깊게** 파고, 그 위에 AI 이미지 검색이라는 차별 기능을 얹은 것이다.

## 2. 아키텍처 개요

```
[React(Vite) SPA]  ──HTTP/JSON──►  [NestJS API]  ──►  [PostgreSQL]   (주문/상품/재고/사용자)
       │                               │        ──►  [Redis]        (게스트 장바구니·세션·SSE 티켓)
       │                               └──SSE───►  관리자 대시보드 실시간(재고/주문)
       └─ 브라우저 CLIP/DINOv2 임베딩 계산 ─► POST /products/search-by-image (서버는 코사인 유사도만)
[TossPayments] ◄── 결제 승인/취소(재시도·멱등) ── [NestJS]
```

- **Backend**: NestJS + TypeORM(PostgreSQL) + ioredis. 기능별 모듈(products/cart/orders/payments/auth/admin).
- **동시성**: 주문 생성 시 `SELECT ... FOR UPDATE`(비관적 락)로 재고 차감.
- **실시간**: SSE(`@Sse()`) + RxJS Subject — 단일 인스턴스에 충분(Kafka 미도입).
- **AI 검색**: 임베딩 계산은 **브라우저(사용자 기기)**, 서버는 벡터 코사인 유사도만 → 서버 CPU·외부 API 비용 0.
- **배포**: Render(백엔드, Docker) + Supabase(PostgreSQL) + Upstash(Redis) + Cloudflare Pages(프론트).

## 3. 핵심 설계 판단과 맞바꾼 것(trade-offs)

각 판단은 **비교한 대안 → 선택 근거 → 맞바꾼 것 → 재검토 트리거**로 관리한다(전체 45개는 `CLAUDE.md`). 대표 6가지:

### (1) 동시성 제어 → 비관적 락 (`SELECT ... FOR UPDATE`)
- **대안**: 낙관적 락(`@Version`), Redis 분산 락, 원자적 `UPDATE ... WHERE stock > 0`.
- **선택/맞바꿈**: 정확성(초과 판매 0)을 최우선. 락 대기로 인한 처리량 저하를 **감수**. 현재 트래픽에서 체감 지연 없음.
- **재검토**: 동시 요청량이 늘어 대기가 체감되면 → 원자적 업데이트/분산 락.

### (2) AI 이미지 검색 → 클라이언트사이드 임베딩(자체 호스팅)
- **대안(5가지 비교)**: Vision LLM 원샷 비교 / 속성 추출 / 호스팅 임베딩 API(Voyage·Cohere) / 서버사이드 CLIP / **클라이언트사이드 CLIP·DINOv2**.
- **선택/맞바꿈**: "외부 API 비용 0 + 서버 CPU 부담 0"을 위해 브라우저에서 임베딩 계산. **맞바꾼 것**: 첫 로드 시 모델 다운로드 지연(양자화 q8·유휴 프리페치로 완화), 상용 대비 다소 낮은 정확도.
- **개정**: CLIP→DINOv2(시각 리트리벌 분리도 약 4배)→패치 mean-pooling→사용자 카테고리 필터(옷 카테고리 자동 구분 한계를 정직하게 인정).

### (3) 결제 미완료(PENDING) 처리 → 뷰 숨김 + 만료 회수(재고 반납), 상태는 DB 유지
- **대안**: (A) 생성 시 예약 유지 + 만료 회수 vs (B) payment-first(결제 확정 시 차감).
- **선택/맞바꿈**: **A** — 오버셀 불가·결제 중 손님 보호를 지키는 저리스크 증분. **맞바꾼 것**: 이탈자가 TTL(30분) 동안 "가짜 품절"을 만들 수 있음. (B)는 결제창 막판 거절 UX + 돈 경로 재구조화라 Ledger 단계로 미룸.

### (4) 관리자 인증 → 정적 토큰에서 로그인 세션 + role 기반으로 전환
- **맞바꿈**: 매 요청 DB에서 role 확인(캐싱 안 함) → 권한 회수가 재로그인 없이 즉시 반영. 관리자 API는 트래픽이 적어 요청당 조회 1회 비용 감수.

### (5) 에러 응답 → 커스텀 단순 포맷 `{ statusCode, message, code }`
- **맞바꿈**: RFC 7807 대신 낮은 구현 비용. 대신 `code` 필드로 프론트가 메시지 텍스트가 아닌 코드로 분기 → 국제화·문구 변경에 견고. 전 에러를 `AppErrors` 단일 카탈로그로 중앙화.

### (6) 상품 응답 캐시 → 인메모리, 상품 조회 2개 라우트로 한정
- **맞바꿈**: 단일 인스턴스라 Redis 공유 캐시 불필요. `/cart`·`/admin/*`·`/orders/lookup`은 사용자 구분/실시간성 때문에 **의도적으로 제외**(캐시 키 URL 기준이라 장바구니가 섞이는 버그를 설계 단계에서 배제).

## 4. 데이터 모델 (요약)

```
categories ─1:N─ products ─1:N─ product_options(재고, 락 대상, is_active)
orders ─1:N─ order_items ─N:1─ product_options
orders: order_number(조회키)·buyer_email·status(PENDING|PAID|SHIPPED|DELIVERED|CANCELLED|EXPIRED)
        ·payment_key·tracking_number·carrier·user_id(nullable, 게스트는 null)
delivery_events(주문당 1:N, 배송 단계 타임라인)
users(email UNIQUE, password_hash, role) · cart_items(로그인 사용자 장바구니)
```
- 스키마 변경은 **TypeORM 마이그레이션**(멱등적)으로 관리, 배포 시 `migrationsRun`으로 자동 적용.
- 게스트 장바구니는 Redis(`cart:{cartId}`, TTL 14일), 로그인 사용자는 DB(`cart_items`) — 하이브리드.

## 5. 사용법 (로컬 실행 · API)

### 로컬 실행
```bash
# 1) 인프라 (PostgreSQL 5433, Redis 6379)
docker compose up -d

# 2) 백엔드
cd backend
cp .env.example .env        # DB/Redis 접속값 확인
npm install
npm run start               # http://localhost:3001  (마이그레이션 자동 적용)

# 3) 프론트엔드(선택, 데모용)
cd ../frontend && npm install && npm run dev   # http://localhost:5173

# 4) API 문서
# http://localhost:3001/docs  (Swagger UI, "Authorize"로 X-Cart-Id/X-Session-Token 테스트)
```

### 대표 API
| Method | Path | 설명 |
|---|---|---|
| GET | `/products?category=&search=&sort=&page=&limit=` | 상품 목록(검색·정렬·페이지네이션) |
| POST | `/products/search-by-image` | 이미지 임베딩(클라 계산)로 시각 유사 상품 top-5 |
| POST | `/orders/validate-stock` | 주문 전 재고 확인(항상 200, `valid` 플래그) |
| POST | `/orders` | 주문 생성(비관적 락 + 재고 차감, 트랜잭션) |
| GET | `/orders/lookup?orderNumber=&email=` | 게스트 주문·배송 조회 |
| POST | `/payments/confirm` | TossPayments 승인(타임아웃·재시도·멱등) |
| GET | `/admin/stats` · `/admin/orders/recent` | 통계·주문 관리(role=admin) |
| GET | `/health` | DB/Redis 상태(200/503) |

- **공통 헤더**: 장바구니/주문은 `X-Cart-Id`(게스트 UUID), 로그인은 `X-Session-Token`.
- **에러 포맷**: `{ statusCode, message, code }`.

부하 테스트 실행법과 지표는 [평가 리포트](./02-evaluation-report.md)를 참고.
