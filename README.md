# CommerceCore

프로덕션 품질을 지향하는 이커머스 포트폴리오 프로젝트.
비관적 락 기반 동시성 제어, 로그인 세션(자체 구현), Redis/DB 하이브리드 장바구니, TossPayments 결제, 배송 추적, 브라우저에서 실행되는 CLIP 이미지 유사도 검색, SSE 실시간 관리자 대시보드를 구현했습니다.

**Live Demo**
- Frontend: https://commercecore.pages.dev
- Backend API: https://commerce-core-backend.onrender.com
- API 문서 (Swagger): https://commerce-core-backend.onrender.com/docs

> Render 무료 티어 사용으로 15분 비활성 후 슬립 상태로 전환됩니다. 첫 요청 시 응답이 30초 정도 걸릴 수 있습니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Backend | NestJS, TypeORM (마이그레이션 기반), PostgreSQL |
| Cache / 세션 / 장바구니(게스트) | Redis (ioredis) |
| Frontend | React, Vite, TypeScript |
| 실시간 | Server-Sent Events (SSE, RxJS Subject) |
| 이미지 유사도 검색 | `transformers.js` (CLIP, 브라우저에서 직접 추론) |
| 결제 | TossPayments |
| 이미지 스토리지 | Supabase Storage |
| API 문서 | Swagger (`@nestjs/swagger`) |
| DB (프로덕션) | Supabase (PostgreSQL) |
| Redis (프로덕션) | Upstash |
| 배포 | Render (백엔드), Cloudflare Pages (프론트엔드) |
| CI | GitHub Actions (typecheck → lint → unit → e2e) |
| 부하테스트 | k6 |

---

## 핵심 기능

### 상품 카탈로그
- 카테고리별 상품 목록 조회 (페이지네이션)
- 상품 상세 + 옵션(사이즈/색상)별 재고 조회
- **이미지 기반 유사 상품 검색**: 업로드 이미지를 브라우저에서 CLIP으로 임베딩 계산 후, 서버가 코사인 유사도로 카탈로그와 비교 (외부 API 비용 없음)
- 관리자 상품 등록 + 이미지 업로드 (Supabase Storage)

### 장바구니
- **게스트**: Redis 해시(`cart:{cartId}`, TTL 14일), 클라이언트 UUID를 `X-Cart-Id` 헤더로 전달
- **로그인 사용자**: DB(`cart_items`)에 영구 보관, 회원가입/로그인 시 게스트 장바구니 자동 병합
- 상품 추가 / 수량 변경 / 항목 삭제 / 전체 조회 (같은 엔드포인트가 세션 유무로 저장소만 분기)

### 회원가입 / 로그인 / 마이페이지
- 이메일 + 비밀번호(bcryptjs), Redis 세션(`session:{token}`, TTL 14일) + `X-Session-Token` 헤더
- 내 주문 목록 / 상세 조회 (다른 사용자의 주문은 404로 응답 — 존재 여부 자체를 노출하지 않음)

### 주문
- **비관적 락** (`SELECT ... FOR UPDATE`)으로 동시 주문 시 재고 초과 판매 방지
- 주문 전 재고 사전 확인 API 분리 (`POST /orders/validate-stock`)
- 게스트: 주문번호 + 이메일 조합으로 조회 / 로그인 사용자: 계정에 자동 연결
- **배송 추적**: 송장번호/택배사 저장 + 배송 단계 타임라인(COLLECTED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED) 자체 구현

### 결제 (TossPayments)
- 주문서 작성 → 주문 생성 → 즉시 TossPayments 카드 결제창 호출
- 결제 성공 시 `/payment/success`로 리다이렉트, 백엔드 승인 API 호출 후 주문 상태 PAID 전이
- 결제 실패/취소 시 `/payment/fail`로 리다이렉트, 주문 상태 PENDING 유지
- 금액 위변조 방지: DB `total_amount` vs 요청 `amount` 서버 사전 검증
- 타임아웃(10초) + 재시도(네트워크 에러/5xx, 최대 2회) + `Idempotency-Key` 헤더 + 멱등 에러 코드 처리
- 관리자 주문 취소(PAID→CANCELLED) 시 TossPayments 결제취소 API 호출 후 성공해야 상태 전이

### 관리자 대시보드
- 전체 재고 현황(카테고리 탭 필터) / 최근 주문 목록(상태 탭 + 구매자 검색 + 서버사이드 페이지네이션)
- 주문 상태 전이 + 배송 단계 기록, 상품 등록
- **SSE 실시간 갱신**: 재고 변경·신규 주문·상태 변경 발생 시 새로고침 없이 자동 반영
- **인증**: 로그인 세션 + `role='admin'` 기반(정적 토큰 아님). SSE는 1회용 단기 티켓(TTL 30초)으로 별도 인증

### 운영/보안
- `GET /health`로 DB/Redis 연결 상태 확인
- `helmet` 보안 헤더, `trust proxy` 설정, 전역 rate limit(100회/60초) + 로그인/회원가입 별도 강화 제한(10회/60초)
- 에러 응답에 `code` 필드로 중앙화된 에러 카탈로그 제공 (프론트가 문자열 대신 코드로 분기)

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
npm run migration:run   # DB 스키마 적용 (마이그레이션 기반, 결정 29)
npm run start:dev        # http://localhost:3001

# 3. 프론트엔드 (별도 터미널)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

### 환경변수 (`backend/.env`)

```env
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=commerce
DB_PASSWORD=commerce_local_pw
DB_DATABASE=commerce_core

REDIS_HOST=localhost
REDIS_PORT=6379

PORT=3001
CORS_ORIGIN=http://localhost:5173

# TossPayments — 개발자센터 > 내 상점 > API 개별 연동 키
TOSSPAYMENTS_SECRET_KEY=test_sk_...

# 선택 (미설정 시 기본값 사용)
THROTTLE_LIMIT=100
THROTTLE_TTL_MS=60000
DB_POOL_MAX=10

# 선택 — 관리자 상품 이미지 업로드 (미설정 시 이미지 업로드만 실패, 나머지는 정상 동작)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_STORAGE_BUCKET=product-images
```

프론트엔드는 루트에 `.env.local` 생성:

```env
VITE_TOSSPAYMENTS_CLIENT_KEY=test_ck_...
```

> PostgreSQL 컨테이너는 로컬 충돌 방지를 위해 `5433:5432`로 매핑합니다.

관리자 계정으로 사용하려면 회원가입 후 직접 승격이 필요합니다:

```sql
UPDATE users SET role = 'admin' WHERE email = '본인 이메일';
```

### DB 스키마 적용

스키마는 TypeORM 마이그레이션(`backend/src/migrations/`)이 기준입니다. `commerce-core-schema.sql`은 ERD 시각화용 초기 스냅샷으로만 참고하세요.

```bash
cd backend
npm run migration:run
```

---

## API 명세

전체 명세는 Swagger UI(`/docs`)에서 확인할 수 있습니다. 아래는 요약입니다.

**공통**: 장바구니/주문 요청에 `X-Cart-Id` 헤더, 로그인 사용자 요청은 `X-Session-Token` 헤더 필요.
에러 응답 포맷: `{ "statusCode": number, "message": string, "code": string }`

### 상품

| Method | Path | 설명 |
|---|---|---|
| GET | `/products?category=&page=&limit=` | 카테고리별 상품 목록 (페이지네이션) |
| GET | `/products/:id` | 상품 상세 + 옵션별 재고 |
| POST | `/products/search-by-image` | 이미지 임베딩 기반 유사 상품 검색 (`{ embedding: number[] }`) |

### 장바구니

| Method | Path | 설명 |
|---|---|---|
| GET | `/cart` | 장바구니 조회 |
| POST | `/cart/items` | 상품 추가 |
| PATCH | `/cart/items/:productOptionId` | 수량 변경 |
| DELETE | `/cart/items/:productOptionId` | 항목 제거 |

### 회원 (Auth)

| Method | Path | 설명 |
|---|---|---|
| POST | `/auth/register` | 회원가입 (즉시 로그인, 게스트 장바구니 병합) |
| POST | `/auth/login` | 로그인 (게스트 장바구니 병합) |
| POST | `/auth/logout` | 로그아웃 (세션 파기) |
| GET | `/auth/me` | 현재 로그인 사용자 조회 |

### 주문

| Method | Path | 설명 |
|---|---|---|
| POST | `/orders/validate-stock` | 주문 전 재고 확인 (항상 200) |
| POST | `/orders` | 주문 생성 (비관적 락 + 트랜잭션, 로그인 시 계정 자동 연결) |
| GET | `/orders/lookup?orderNumber=&email=` | 게스트 주문 조회 (주문번호+이메일 조합) |
| GET | `/orders/my?page=&limit=` | 로그인 필요. 내 주문 목록 |
| GET | `/orders/my/:orderNumber` | 로그인 필요. 내 주문 상세 |

### 결제

| Method | Path | 설명 |
|---|---|---|
| POST | `/payments/confirm` | TossPayments 승인. `{ paymentKey, orderId, amount }` → 금액 검증 후 승인 API 호출 → 주문 PAID |

### 관리자 (`X-Session-Token` + `role=admin` 세션 필요)

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/categories` | 카테고리 목록 (상품 등록 폼용) |
| POST | `/admin/products` | 상품 등록 |
| POST | `/admin/products/upload-image` | 상품 이미지 업로드 (Supabase Storage) |
| GET | `/admin/stock-overview` | 전체 재고 현황 |
| GET | `/admin/orders/recent?status=&page=&limit=&search=` | 주문 목록 (필터/검색/페이지네이션) |
| PATCH | `/admin/orders/:orderNumber/status` | 주문 상태 전이 |
| POST | `/admin/orders/:orderNumber/delivery-events` | 배송 단계 기록 |
| POST | `/admin/events/ticket` | SSE용 1회용 단기 티켓 발급 |
| GET | `/admin/events?ticket=` | SSE 스트림 (`stock-update`, `order-update`) |

### 헬스체크

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | DB/Redis 연결 상태 확인 (인증 불필요) |

---

## 주요 설계 결정

| 결정 | 선택 | 근거 |
|---|---|---|
| 동시성 제어 | 비관적 락 (`SELECT ... FOR UPDATE`) | 재고 초과 판매 방지 정확성 우선 |
| 장바구니 저장소 | 게스트: Redis / 로그인: DB (하이브리드) | 비로그인 지원 + 로그인 사용자 데이터는 영구 보관 |
| 관리자 인증 | 로그인 세션 + `role` 기반 (정적 토큰 아님) | 계정 단위 권한 회수, 자격증명 하드코딩 회피 |
| 실시간 갱신 | SSE (RxJS Subject) | 단방향 스트림으로 충분, WebSocket 불필요 |
| 주문 조회(게스트) | 주문번호 + 이메일 조합 | 이메일 단독 조회의 보안 취약점 방지 |
| 재고 확인 분리 | `validate-stock` API 별도 제공 | 주문 실패 전 품절 상품 사전 안내 |
| 이미지 유사도 검색 | 클라이언트사이드 CLIP (`transformers.js`) | 외부 API/서버 추론 비용 없이 시각적 유사도 확보 |
| DB 스키마 관리 | TypeORM 마이그레이션 | 로컬/CI/프로덕션 스키마 동일성 보장 |

자세한 설계 결정 로그(비교한 대안, 트러블슈팅, 재검토 트리거)는 [CLAUDE.md](./CLAUDE.md)를 참고하세요.

---

## 성능 진단 & 부하테스트 결과

- **동시성 검증(k6)**: 재고 1개인 상품에 동시 10명이 주문 시도 → 성공 1건 / 실패(409) 9건, 최종 재고 0개. 비관적 락이 재고 초과 판매를 정확히 방지함을 확인.
- **성능 병목 진단**: `GET /orders/lookup`에서 VU 증가에도 처리량이 늘지 않는 포화 패턴 발견 → DB 커넥션 풀/쿼리 실행시간 반증 → TypeORM 관계 조립 비용이 원인으로 특정 → 조회를 "존재 확인 → 존재 시 관계 조회" 2단계로 분리해 처리량 +60%, p95 응답시간 -38% 개선.

---

## 폴더 구조

```
CommerceCore/
├── backend/                       # NestJS API 서버
│   ├── src/
│   │   ├── products/              # 상품 카탈로그 + 이미지 유사도 검색
│   │   ├── cart/                  # 장바구니 (Redis + DB 하이브리드)
│   │   ├── orders/                # 주문 (비관적 락) + 배송 추적
│   │   ├── payments/               # TossPayments 연동
│   │   ├── auth/                  # 회원가입/로그인/세션
│   │   ├── admin/                 # 관리자 대시보드 + 상품 등록/이미지 업로드
│   │   ├── health/                # 헬스체크
│   │   ├── migrations/            # TypeORM 마이그레이션 (스키마 기준)
│   │   ├── redis/                 # Redis 모듈
│   │   └── common/                # 에러 카탈로그, 가드, 인터셉터, SSE 이벤트
│   └── Dockerfile
├── frontend/                      # React (Vite)
│   └── src/
│       ├── pages/                 # 상품/장바구니/주문/로그인/마이페이지/관리자
│       └── api/
├── commerce-core-schema.sql       # ERD 시각화용 초기 스냅샷 (기준 아님 — src/migrations 참고)
├── docker-compose.yml             # 로컬 개발용 (PostgreSQL, Redis)
└── docker-compose.prod.yml        # 프로덕션 참고용
```

---

## CI

GitHub Actions(`.github/workflows/ci.yml`)가 PR마다 Postgres/Redis를 띄우고 마이그레이션 적용 → typecheck → lint → unit test → e2e test 순으로 실행합니다.

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
