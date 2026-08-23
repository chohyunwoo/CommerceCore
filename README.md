# CommerceCore

프로덕션 품질을 지향하는 이커머스 포트폴리오 프로젝트.  
비관적 락 기반 동시성 제어, Redis 장바구니, SSE 실시간 관리자 대시보드를 구현했습니다.

**Live Demo**
- Frontend: https://commercecore.pages.dev
- Backend API: https://commerce-core-backend.onrender.com

> Render 무료 티어 사용으로 15분 비활성 후 슬립 상태로 전환됩니다. 첫 요청 시 응답이 30초 정도 걸릴 수 있습니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Backend | NestJS, TypeORM, PostgreSQL |
| Cache / 세션 | Redis (ioredis) |
| Frontend | React, Vite, TypeScript |
| 실시간 | Server-Sent Events (SSE, RxJS Subject) |
| DB (프로덕션) | Supabase (PostgreSQL) |
| Redis (프로덕션) | Upstash |
| 배포 | Render (백엔드), Cloudflare Pages (프론트엔드) |
| 부하테스트 | k6 |

---

## 핵심 기능

### 상품 카탈로그
- 카테고리별 상품 목록 조회
- 상품 상세 + 옵션(사이즈/색상)별 재고 조회

### 장바구니
- Redis 기반 비로그인 장바구니 (`cart:{sessionId}` 해시, TTL 14일)
- 클라이언트 UUID를 `X-Cart-Id` 헤더로 전달해 세션 식별
- 상품 추가 / 수량 변경 / 항목 삭제 / 전체 조회

### 주문
- **비관적 락** (`SELECT ... FOR UPDATE`)으로 동시 주문 시 재고 초과 판매 방지
- 주문 전 재고 사전 확인 API 분리 (`POST /orders/validate-stock`)
- 주문번호 + 이메일 조합으로 게스트 주문 조회

### 결제 (TossPayments)
- 주문서 작성 → 주문 생성 → 즉시 TossPayments 카드 결제창 호출
- 결제 성공 시 `/payment/success`로 리다이렉트, 백엔드 승인 API 호출 후 주문 상태 PAID 전이
- 결제 실패/취소 시 `/payment/fail`로 이다이렉트, 주문 상태 PENDING 유지
- 금액 위변조 방지: DB `total_amount` vs 요청 `amount` 서버 사전 검증

### 관리자 대시보드
- 전체 재고 현황 / 최근 주문 목록 조회
- 주문 상태 전이 (PENDING → PAID → SHIPPED → DELIVERED / CANCELLED)
- **SSE 실시간 갱신**: 재고 변경·신규 주문 발생 시 페이지 새로고침 없이 자동 반영
- 토큰 기반 인증 (`X-Admin-Token` 헤더 또는 `?token=` 쿼리 파라미터)

---

## 로컬 개발 환경

### 사전 요구사항
- Node.js 20+
- Docker Desktop (PostgreSQL, Redis 컨테이너 실행용)

### 실행

```bash
# 1. 인프라 컨테이너 실행
docker-compose up -d

# 2. 백엔드
cd backend
npm install
npm run start:dev   # http://localhost:3001

# 3. 프론트엔드 (별도 터미널)
cd frontend
npm install
npm run dev         # http://localhost:5173
```

### 환경변수 (`backend/.env`)

```env
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres

REDIS_HOST=localhost
REDIS_PORT=6379

PORT=3001

CORS_ORIGIN=http://localhost:5173

# TossPayments — 개발자센터 > 내 상점 > API 개별 연동 키
TOSSPAYMENTS_SECRET_KEY=test_sk_...
```

프론트엔드는 루트에 `.env.local` 생성:

```env
VITE_TOSSPAYMENTS_CLIENT_KEY=test_ck_...
```

> PostgreSQL 컨테이너는 로컬 충돌 방지를 위해 `5433:5432`로 매핑합니다.

### DB 스키마 적용

pgAdmin 또는 아래 명령으로 `commerce-core-schema.sql`을 실행하세요.

```bash
psql -h localhost -p 5433 -U postgres -d postgres -f commerce-core-schema.sql
```

---

## API 명세

모든 장바구니·주문 요청에 `X-Cart-Id` 헤더 필요.  
에러 응답 포맷: `{ "statusCode": number, "message": string }`

### 상품

| Method | Path | 설명 |
|---|---|---|
| GET | `/products?category=` | 카테고리별 상품 목록 |
| GET | `/products/:id` | 상품 상세 + 옵션별 재고 |

### 장바구니

| Method | Path | 설명 |
|---|---|---|
| GET | `/cart` | 장바구니 조회 |
| POST | `/cart/items` | 상품 추가 |
| PATCH | `/cart/items/:productOptionId` | 수량 변경 |
| DELETE | `/cart/items/:productOptionId` | 항목 제거 |

### 주문

| Method | Path | 설명 |
|---|---|---|
| POST | `/orders/validate-stock` | 주문 전 재고 확인 (항상 200) |
| POST | `/orders` | 주문 생성 (비관적 락 + 트랜잭션) |
| GET | `/orders/lookup?orderNumber=&email=` | 주문번호+이메일 조합 조회 |

### 결제

| Method | Path | 설명 |
|---|---|---|
| POST | `/payments/confirm` | TossPayments 승인. `{ paymentKey, orderId, amount }` → 금액 검증 후 승인 API 호출 → 주문 PAID |

### 관리자 (인증 필요: `X-Admin-Token` 헤더)

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/stock-overview` | 전체 재고 현황 |
| GET | `/admin/orders/recent` | 최근 주문 목록 |
| PATCH | `/admin/orders/:id/status` | 주문 상태 전이 |
| GET | `/admin/events` | SSE 스트림 (`stock-update`, `order-update`) |

---

## 주요 설계 결정

| 결정 | 선택 | 근거 |
|---|---|---|
| 동시성 제어 | 비관적 락 (`SELECT ... FOR UPDATE`) | 재고 초과 판매 방지 정확성 우선 |
| 장바구니 저장소 | Redis | 비로그인 사용자 지원, 빠른 읽기/쓰기 |
| 실시간 갱신 | SSE (RxJS Subject) | 단방향 스트림으로 충분, WebSocket 불필요 |
| 주문 조회 | 주문번호 + 이메일 조합 | 이메일 단독 조회의 보안 취약점 방지 |
| 재고 확인 분리 | `validate-stock` API 별도 제공 | 주문 실패 전 품절 상품 사전 안내 |

자세한 설계 결정 로그는 [CLAUDE.md](./CLAUDE.md)를 참고하세요.

---

## 부하테스트 결과

k6로 재고 1개인 상품에 동시 10명이 주문 시도:

- 성공: 1건 / 실패(409): 9건
- 최종 재고: 0개
- 비관적 락이 재고 초과 판매를 정확히 방지함을 확인

---

## 배포 & keep-warm

- **배포**: 백엔드 Render(Docker) · DB Supabase · 캐시 Upstash(Redis) · 프론트 Cloudflare Pages — 무료 티어.
- **콜드스타트 & keep-warm**(`.github/workflows/keep-warm.yml`): Render 무료 티어는 15분 무활동 시 인스턴스를 내리고 다음 요청은 콜드스타트로 30초~1분 걸린다. GitHub Actions로 활동 시간대에 `GET /health`를 핑해 깨워두는데, 단순 `*/10` cron은 GitHub이 실행을 지연·누락시켜(실측 34분 갭) 15분 spin-down을 못 막았다. 그래서:
  - **매시 정시 트리거 + 잡 내부 sleep 루프** — "언제 시작하냐"만 GitHub에 맡기고(정시 트리거는 상대적으로 안정적), 실제 핑 간격(5분)은 러너의 `sleep`으로 정확히 보장한다.
  - 각 잡을 **~70분** 돌려 다음 정시 잡과 **~10분 겹치게(overlap)** 해, 트리거가 지연돼도 경계에서 갭이 생기지 않는다(잡끼리 서로 취소하지 않도록 `concurrency`는 두지 않음).
  - 활동 시간대는 **KST 10:00~22:00**(cron은 UTC 기준 `0 1-12`). Render 무료 **750 instance-hours**가 계정 내 무료 서비스(SpotScore 등)와 공유되므로, 12시간 × 2개 서비스 ≈ 월 720h로 한도 안에 들도록 창을 제한한다. 이 절충 때문에 **심야(22~10시)엔 첫 접속이 콜드스타트로 느릴 수 있다**.

---

## 폴더 구조

```
CommerceCore/
├── backend/                      # NestJS API 서버
│   ├── src/
│   │   ├── products/             # 상품 카탈로그
│   │   ├── cart/                 # 장바구니 (Redis)
│   │   ├── orders/               # 주문 (비관적 락)
│   │   ├── admin/                # 관리자 대시보드
│   │   ├── redis/                # Redis 모듈
│   │   └── common/events/        # SSE 이벤트 (RxJS Subject)
│   └── Dockerfile
├── frontend/                     # React (Vite)
│   └── src/
│       ├── pages/
│       └── api/
├── commerce-core-schema.sql      # DDL + 시드 데이터
├── docker-compose.yml            # 로컬 개발용 (PostgreSQL, Redis)
└── docker-compose.prod.yml       # 프로덕션 참고용
```

---

## 커밋 컨벤션 & Pre-commit 훅 (Husky)

`feat/fix/refactor/docs/test/chore` 타입의 커밋 메시지만 허용합니다.  
루트에서 `npm install` 시 Husky 훅이 자동 등록됩니다.

```
CommerceCore/
├── .husky/
│   ├── pre-commit      # 줄 끝 공백, 개행, 병합 충돌 마커, 대용량 파일 검사
│   └── commit-msg      # commitlint 실행
└── commitlint.config.js
```
