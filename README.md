# CommerceCore

프로덕션 품질을 지향하는 이커머스 포트폴리오 프로젝트.
비관적 락 기반 동시성 제어, 자체 회원/세션 인증, TossPayments 결제, 브라우저 임베딩 기반 AI 이미지 유사도 검색, SSE 실시간 관리자 대시보드를 구현했습니다.

**Live Demo**
- Frontend: https://commercecore.pages.dev
- Backend API: https://commerce-core-backend.onrender.com
- API 문서 (Swagger): https://commerce-core-backend.onrender.com/docs

> Render 무료 티어 사용으로 15분 비활성 후 슬립 상태로 전환됩니다. 첫 요청 시 응답이 30초 정도 걸릴 수 있습니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Backend | NestJS, TypeORM, PostgreSQL |
| Cache / 세션 | Redis (ioredis) |
| 인증 | bcryptjs 비밀번호 해싱, Redis 세션 토큰, role 기반 관리자 인가 |
| 결제 | TossPayments (타임아웃·재시도·Idempotency-Key) |
| AI 이미지 검색 | transformers.js (DINOv2, 브라우저 임베딩) + 서버 코사인 유사도, Supabase Storage |
| Frontend | React, Vite, TypeScript, Recharts |
| 실시간 | Server-Sent Events (SSE, RxJS Subject) |
| DB (프로덕션) | Supabase (PostgreSQL) |
| Redis (프로덕션) | Upstash |
| 배포 | Render (백엔드), Cloudflare Pages (프론트엔드) |
| 테스트 / CI | Jest (유닛·e2e), GitHub Actions |
| 부하테스트 | k6 |

---

## 핵심 기능

### 상품 카탈로그
- 카테고리·상품명 검색·가격 범위·정렬(최신/가격/이름) 필터 + 페이지네이션
- 상품 상세 + 옵션(사이즈/색상)별 재고 조회
- **AI 이미지 유사도 검색**: 브라우저에서 DINOv2(transformers.js, q8)로 업로드 이미지 임베딩을 계산하고, 서버는 저장된 카탈로그 벡터와 코사인 유사도만 계산해 top-5 추천 — 외부 API·서버 추론 비용 없이 시각적 유사도 검색

### 회원 / 인증
- 이메일·비밀번호 회원가입/로그인 (bcryptjs 해싱), Redis 세션 + `X-Session-Token` 헤더
- 로그인/회원가입 시 게스트 장바구니(`X-Cart-Id`)를 계정 장바구니로 병합

### 장바구니 (하이브리드)
- 게스트: Redis (`cart:{cartId}` 해시, TTL 14일), 클라이언트 UUID를 `X-Cart-Id` 헤더로 전달
- 로그인 사용자: PostgreSQL `cart_items`에 영구 보관 (TTL 없음)
- 상품 추가 / 수량 변경 / 항목 삭제 / 전체 조회 — 저장소만 분기하고 API 형태는 동일

### 주문 / 결제
- **비관적 락** (`SELECT ... FOR UPDATE`)으로 동시 주문 시 재고 초과 판매 방지
- 주문 전 재고 사전 확인 API 분리 (`POST /orders/validate-stock`)
- 게스트: 주문번호+이메일 조합 조회 / 로그인: 마이페이지(내 주문 목록·상세)
- **TossPayments 결제 승인·취소**: 10초 타임아웃, 5xx·네트워크 오류 한정 재시도, 공식 `Idempotency-Key` 헤더로 중복 결제 방지
- 결제 미완료(PENDING)·이탈 주문은 사용자·관리자 조회 뷰에서 숨기고, 만료 시점에 재고 자동 회수(EXPIRED 전이) + 주문 취소 시 재고 복원
- 배송 추적: 송장번호/택배사 + 배송 단계 타임라인(수거→간선상차→배송출발→배송완료)

### 관리자 대시보드 (role 기반 인증)
- 재고 현황 / 주문 목록 (상태 필터·구매자 검색·페이지네이션)
- 매출·판매 통계 시각화 (Recharts), 회원·구매자 조회, 상품 관리(등록·소프트 삭제·재입고·옵션 추가)
- 주문 상태 전이 + 배송 단계 기록
- **SSE 실시간 갱신**: 재고 변경·신규 주문·상태 변경 시 페이지 새로고침 없이 자동 반영
- 인증: 로그인 세션(`X-Session-Token`) + `users.role = admin`. SSE는 커스텀 헤더 제약 때문에 1회용 단기 티켓(`?ticket=`)으로 인증

---

## 로컬 개발 환경

### 사전 요구사항
- Node.js 20+
- Docker Desktop (PostgreSQL, Redis 컨테이너 실행용)

### 실행

```bash
# 1. 인프라 컨테이너 실행
docker-compose up -d

# 2. 백엔드 (부팅 시 마이그레이션 자동 적용)
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

# (선택) 관리자 상품 이미지 업로드에만 필요
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=product-images
```

프론트엔드는 루트에 `.env.local` 생성:

```env
VITE_TOSSPAYMENTS_CLIENT_KEY=test_ck_...
```

> PostgreSQL 컨테이너는 로컬 충돌 방지를 위해 `5433:5432`로 매핑합니다.
> 전체 항목은 `backend/.env.example` · `frontend/.env.example` 참고.

### DB 스키마

백엔드 부팅 시 TypeORM 마이그레이션이 **자동 적용**됩니다(`migrationsRun: true`). 별도 스키마 실행이 필요 없습니다.

- 마이그레이션 기준: `backend/src/migrations/` (모두 멱등적)
- `commerce-core-schema.sql`은 ERD 시각화용 참고 스냅샷입니다.
- 수동 실행이 필요하면: `cd backend && npm run migration:run`

### 관리자 계정 승격

관리자 기능은 `users.role = 'admin'` 계정만 접근할 수 있습니다. 회원가입 후 DB에서 1회 승격합니다.

```sql
UPDATE users SET role = 'admin' WHERE email = '본인 이메일';
```

---

## API 명세

공통 헤더: 장바구니·주문 요청에 `X-Cart-Id`, 로그인 요청에 `X-Session-Token`.
에러 응답 포맷: `{ "statusCode": number, "message": string, "code": string }`

### 상품

| Method | Path | 설명 |
|---|---|---|
| GET | `/products?category=&page=&limit=&search=&sort=&minPrice=&maxPrice=` | 상품 목록 (필터·정렬·페이지네이션) |
| GET | `/products/:id` | 상품 상세 + 옵션별 재고 |
| POST | `/products/search-by-image` | 이미지 유사도 검색 (`{ embedding: number[] }` → 코사인 유사도 top-5) |

### 회원 (Auth)

| Method | Path | 설명 |
|---|---|---|
| POST | `/auth/register` | 회원가입 (성공 시 세션 발급, 게스트 장바구니 병합) |
| POST | `/auth/login` | 로그인 (게스트 장바구니 병합) |
| POST | `/auth/logout` | 세션 파기 (멱등) |
| GET | `/auth/me` | 현재 로그인 사용자 조회 |

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
| GET | `/orders/lookup?orderNumber=&email=` | 게스트 주문 조회 (배송 타임라인 포함) |
| GET | `/orders/my?page=&limit=` | 로그인: 내 주문 목록 |
| GET | `/orders/my/:orderNumber` | 로그인: 내 주문 상세 |

### 결제

| Method | Path | 설명 |
|---|---|---|
| POST | `/payments/confirm` | TossPayments 승인 (`{ paymentKey, orderId, amount }` → 금액 검증 후 승인 → 주문 PAID) |

### 관리자 (인증: `X-Session-Token` + role=admin)

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/stock-overview` | 전체 재고 현황 (카테고리별) |
| GET | `/admin/orders/recent?status=&page=&limit=&search=` | 주문 목록 (PENDING 제외) |
| GET | `/admin/stats` | 매출·판매 통계 집계 |
| GET | `/admin/members` · `/admin/buyers` | 회원·구매자 조회/검색 |
| GET | `/admin/products` | 관리자 상품 목록 |
| POST | `/admin/products` · `POST /admin/products/:id/options` | 상품·옵션 등록 |
| PATCH | `/admin/orders/:id/status` | 주문 상태 전이 |
| POST | `/admin/orders/:id/delivery-events` | 배송 단계 기록 |
| POST | `/admin/events/ticket` | SSE 1회용 단기 티켓 발급 |
| GET | `/admin/events?ticket=` | SSE 스트림 (`stock-update`, `order-update`) |

### 헬스체크

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | DB(`SELECT 1`)·Redis(`PING`) 상태. 정상 200 / 하나라도 실패 503 |

---

## 주요 설계 결정

| 결정 | 선택 | 근거 |
|---|---|---|
| 동시성 제어 | 비관적 락 (`SELECT ... FOR UPDATE`) | 재고 초과 판매 방지 정확성 우선 |
| 장바구니 저장소 | 게스트 Redis / 로그인 DB (하이브리드) | 휘발성은 Redis(TTL), 신원 데이터는 DB 영구 보관 |
| 실시간 갱신 | SSE (RxJS Subject) | 단방향 스트림으로 충분, WebSocket 불필요 |
| 관리자 인증 | 로그인 세션 + `users.role` (RBAC) | 정적 토큰의 탈취·회수 취약점 해소, 계정 단위 권한 회수 |
| AI 이미지 검색 | 클라이언트사이드 임베딩(DINOv2) | 서버 추론·외부 API 비용 0, 서버는 코사인 유사도만 |
| 주문 조회 | 주문번호 + 이메일 조합 | 이메일 단독 조회의 보안 취약점 방지 |
| 유령 재고 | 이탈 PENDING 만료 회수(Lazy) | 무료 티어 슬립으로 cron 불가 → 요청 시점 회수 |

자세한 설계 결정 로그(45개)는 [CLAUDE.md](./CLAUDE.md)를 참고하세요.

---

## 테스트

```bash
cd backend
npm run test        # 유닛 테스트 (Repository/Redis/fetch 모킹, 비즈니스 로직 검증)
npm run test:e2e    # e2e (실제 AppModule + 진짜 DB/Redis 부팅, 전체 흐름 검증)
```

- 유닛 107개 / e2e 17개
- 매 PR마다 GitHub Actions CI에서 typecheck → lint → 유닛 → e2e + 마이그레이션 실행

---

## 부하테스트 결과

k6로 재고 1개인 상품에 동시 10명이 주문 시도:

- 성공: 1건 / 실패(409): 9건
- 최종 재고: 0개
- 비관적 락이 재고 초과 판매를 정확히 방지함을 확인

```bash
k6 run k6/order-concurrency.js       # 동시성 정확성(오버셀 0)
k6 run k6/throughput-test.js         # 처리량 게이트(p95·오류율 thresholds)
```

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
│   │   ├── products/             # 상품 카탈로그 + 이미지 유사도 검색
│   │   ├── cart/                 # 장바구니 (게스트 Redis / 로그인 DB)
│   │   ├── orders/               # 주문 (비관적 락, 유령 재고 회수)
│   │   ├── payments/             # TossPayments 승인·취소
│   │   ├── auth/                 # 회원가입·로그인·세션
│   │   ├── admin/                # 관리자 대시보드·통계·상품 관리
│   │   ├── redis/                # Redis 모듈
│   │   ├── migrations/           # TypeORM 마이그레이션 (부팅 시 자동 적용)
│   │   └── common/               # 에러·가드·이벤트(SSE)·인터셉터
│   ├── test/                     # e2e 테스트
│   └── Dockerfile
├── frontend/                     # React (Vite)
│   └── src/
│       ├── pages/                # 상품·장바구니·주문·마이페이지·관리자·이미지검색
│       ├── lib/                  # 이미지 임베딩(DINOv2), cartId 등
│       └── api/
├── k6/                           # 부하테스트 스크립트
├── commerce-core-schema.sql      # ERD 시각화용 참고 스냅샷 (기준은 migrations/)
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
