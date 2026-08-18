# CLAUDE.md — Commerce Core

이 파일은 Commerce Core 프로젝트의 지속적인 컨텍스트를 담습니다. 새 대화를 시작할 때 이 파일을 먼저 참고하세요.

## 프로젝트 개요

프로덕션 품질을 지향하는 이커머스 포트폴리오 프로젝트. 기술 면접에서 방어 가능한 수준의 아키텍처를 목표로 함.

- **핵심 구성요소**: Payment Orchestration Layer, 자체 Double-entry Ledger, 멀티 PG 연동(TossPayments + PortOne), 정산 배치(reconciliation)
- **개발 순서**: B2C 먼저 구축 → B2B는 Phase 2 (승인 워크플로우, 계약 단가, 여신/인보이스)
- **선행 아키텍처 원칙**:
  - Ledger는 결제수단에 독립적으로 설계 (특정 PG에 종속되지 않도록)
  - User 모델은 향후 기업 소속 사용자 확장을 고려해 설계

## 기술 스택

- Backend: NestJS + PostgreSQL
- Cache/세션: Redis (ioredis)
- Frontend: React (Vite)
- 실시간: Server-Sent Events (SSE, RxJS Subject)
- 부하테스트: k6

## 배포 환경 (2026-08-16 완료)

| 영역 | 서비스 |
|---|---|
| 프론트엔드 | Cloudflare Pages — https://commercecore.pages.dev |
| 백엔드 | Render (무료 티어, Docker 기반) — https://commerce-core-backend.onrender.com |
| DB | Supabase PostgreSQL (Singapore 리전, IPv6 이슈로 Pooler URL 사용) |
| Redis | Upstash (TLS, `rediss://` URL) |

- Render 무료 티어: 15분 비활성 후 슬립 → 첫 요청 응답 30초 내외 소요
- 환경변수 템플릿: `.env.prod.example` 참고

## 폴더 구조

```
CommerceCore/
  CLAUDE.md
  docker-compose.yml
  backend/     <- NestJS
  frontend/    <- React (Vite)
```

## 로컬 개발 환경 → Docker Compose

- **비교한 대안**: PostgreSQL/Redis 직접 설치
- **선택 근거**: Docker Compose는 `docker-compose up` 한 줄로 재현 가능한 환경을 구성할 수 있고, 기존 Kubernetes 경험을 가볍게 재사용 가능. 컨테이너 삭제/재설치도 깔끔함.
- **구성**: `docker-compose.yml` (postgres, redis)
- **포트**: 로컬에 기존 PostgreSQL이 5432를 점유해 컨테이너는 `5433:5432`로 매핑. pgAdmin 및 백엔드 `.env`의 `DB_PORT`는 5433 사용.
- **직접 설치가 필요한 것**: Node.js (Docker 여부와 무관하게 NestJS/React 실행에 필요)

## 배포 방향

NCP VM 대신 무료 배포 조합(Render + Supabase + Upstash + Cloudflare Pages)으로 최종 결정. 포트폴리오 목적에 맞게 인프라 비용 없이 실제 운영 환경을 구성함.

- **트러블슈팅 기록**: Supabase 직접 연결 URL은 Render Singapore → Supabase IPv6 주소로 라우팅되어 `ENETUNREACH` 에러 발생 → Pooler URL(`aws-0-ap-southeast-1.pooler.supabase.com:5432`)로 교체해 해결.
- **재검토 트리거**: 트래픽 증가 시뮬레이션이 필요해지는 시점 → NCP VM + Docker Compose 또는 NCP Kubernetes 전환 검토.

## 개발 원칙

- 초반에는 최소 기능(2~3개)만 우선 구현
- 기능 구현 전 항상 여러 대안을 비교하고, 선택에는 근거를 남긴다
- 각 결정에는 재검토 트리거 조건을 함께 기록 (언제 이 결정을 다시 봐야 하는지)

---

## 설계 결정 로그

### 1. 주문 상태 전이 방식 → Enum + Service 레이어 검증

- **비교한 대안**: State 패턴(FSM 클래스 분리), Kafka 이벤트 기반 전이(Choreography)
- **선택 근거**: 초기 단계에는 사용자 수가 적어 주문 전환 자체가 많지 않을 것으로 판단. 상태 종류도 4~5개 수준(PENDING/PAID/SHIPPED/DELIVERED/CANCELLED)으로 유한해, Service 레이어의 단순 검증으로 충분히 방어 가능.
- **재검토 트리거**: 상태 종류가 10개 이상으로 늘어나거나, 주문 처리가 여러 서비스로 분리되는 시점 → State 패턴 또는 이벤트 기반 전이로 전환 검토.

### 2. 동시성 제어 → 비관적 락 (`SELECT ... FOR UPDATE`)

- **비교한 대안**: 낙관적 락(`@Version`), Redis 분산 락
- **선택 근거**: 재고가 적은 상품에 순간적으로 요청이 몰릴 수 있다는 상황을 가정. 정확성(재고 초과 판매 방지)을 우선하며, 현재 트래픽 규모에서는 비관적 락의 트랜잭션 대기로 인한 처리량 저하가 체감되지 않을 것으로 판단.
- **재검토 트리거**: 동시 요청량이 늘어나 대기 지연이 실제로 체감되는 시점 → Redis 분산 락 또는 원자적 업데이트(`UPDATE ... WHERE stock > 0`)로 전환 검토.

### 3. 장바구니 저장소 → Redis 기반

- **비교한 대안**: PostgreSQL 기반, 하이브리드(Redis + DB 병합)
- **선택 근거**: 로그인 기능은 추후 추가 예정. 현 단계에서는 비로그인 사용자가 상품을 장바구니로 옮기는 경험을 우선 확보하는 것이 목표. 하이브리드 방식의 게스트-로그인 병합 로직은 현재 필요한 복잡도를 초과한다고 판단.
- **재검토 트리거**: 로그인 기능 도입 시점 → 하이브리드(Redis + DB 병합) 방식으로 전환 검토.

### 4. 상품 스키마 설계 → 정규화된 스키마

- **비교한 대안**: JSONB 컬럼 활용, EAV 모델
- **선택 근거**: 초기 상품 개수 최대 30개, 카테고리 3개(신발/상의/하의)로 한정. 이 규모에서는 카테고리별 옵션 테이블 관리 부담이 크지 않고, ERD로 명확하게 표현 가능. (판단 기준은 상품 개수가 아니라 카테고리별 속성 다양성임을 확인)
- **재검토 트리거**: 카테고리 종류가 늘어나거나 카테고리마다 속성이 크게 달라지는 시점 → JSONB 컬럼 방식으로 전환 검토.

### 5. 카테고리 간 옵션 테이블 공유

- **배경**: 초기 카테고리를 신발/상의/하의 3개로 확정.
- **결정**: 카테고리별로 별도 옵션 테이블을 만들지 않고, `product_options` 테이블 하나를 공유.
- **근거**: 신발/상의/하의는 카테고리는 다르지만 옵션 속성(사이즈, 색상)이 동일한 구조. `size` 컬럼은 문자열로 통일해 "270"(신발), "M"(옷) 모두 수용.
- **재검토 트리거**: 속성 구조가 크게 다른 카테고리(예: 전자기기의 전압, 식품의 유통기한)가 추가되는 시점 → 카테고리별 옵션 테이블 분리 또는 JSONB 확장 검토.

### 6. 게스트 주문 조회 방식 → 주문번호 + 이메일 조합

- **배경**: 로그인 미구현 상태에서 "내 주문 조회" 기능 여지를 남기고 싶다는 요구.
- **비교한 대안**: (a) 이메일 단독 조회, (b) 조회 기능 자체를 로그인 도입 시점까지 보류, (c) 주문번호+이메일 조합 조회
- **결정**: 주문번호(`order_number`) + 이메일(`buyer_email`) 조합으로만 조회 가능하도록 설계.
- **근거**: 이메일 단독 조회는 타인의 이메일을 대입해 주문을 조회할 수 있는 보안 이슈가 있음. 두 값을 모두 알아야 조회되는 구조로 이 문제를 방어.
- **구현 세부사항**:
  - `order_number`는 내부 PK(`id`, 순차 증가)와 분리된 별도 컬럼. 랜덤 요소가 섞인 문자열(예: `ORD-20260728-A1B2C3`)로 생성해 추측 방지.
  - `id`는 외부에 노출하지 않음.
  - `buyer_email`, `order_number` 모두 인덱스 처리.

### 7. 장바구니 세션 식별 방식 → 클라이언트 생성 UUID (헤더 전달)

- **비교한 대안**: 쿠키 기반 세션 ID
- **선택 근거**: 로컬스토리지는 창을 닫아도, 컴퓨터를 재부팅해도 유지되며 사용자가 의도적으로 브라우저 데이터를 삭제하는 극히 드문 경우에만 소실된다. 초기 단계에는 상품과 재고가 많지 않아 이 정도 리스크는 감수 가능하다고 판단. 쿠키 기반 세션 ID는 쿠키 동의 절차나 차단 설정 등으로 사용자 경험을 침해할 수 있다고 판단해 선택하지 않는다.
- **구현**: 클라이언트가 `crypto.randomUUID()` 등으로 UUID 생성 후 로컬스토리지에 저장, 모든 장바구니/주문 요청에 `X-Cart-Id` 헤더로 전달.

### 8. 재고 확인 API 분리

- **비교한 대안**: 주문 생성 API 하나에서 재고확인·락·차감·주문생성을 한 번에 처리
- **선택 근거**: 하나로 합친 API는 실패 시 어떤 상품이 문제였는지 클라이언트가 다시 파악해야 한다. 재고 확인을 먼저 분리하면 "이 상품이 품절"이라고 주문 시도 전에 명확히 안내할 수 있다는 UX 이점이 있어 선택.
- **구현**: `POST /orders/validate-stock`으로 사전 확인 → `POST /orders`로 실제 생성 (서버에서 재검증 + 비관적 락으로 차감).

### 9. 에러 응답 포맷 → 커스텀 단순 포맷

- **비교한 대안**: RFC 7807 (Problem Details)
- **선택 근거**: 초기에 발생할 수 있는 에러 종류(재고부족, 잘못된 요청, 리소스 없음 등)가 몇 가지로 한정될 것으로 판단해, 구현 비용이 낮은 단순 포맷을 선택.
- **포맷**: `{ "statusCode": number, "message": string, "code": string }`
- **2026-08-18 갱신**: `code` 필드 추가. 비즈니스 에러가 6개 파일 14곳에 문자열로 산발적으로 정의되면서 메시지 중복(`cart.service.ts`에 동일 메시지 2회) 문제가 생겨, `backend/src/common/errors/app-errors.ts`의 `AppErrors` 객체 하나로 모든 에러(`{ status, code, message }`)를 중앙 관리하도록 리팩터링. `AppException`이 이 카탈로그를 받아 던지고, `HttpExceptionFilter`는 `@Catch(HttpException)`에서 `@Catch()`(catch-all)로 확장해 `HttpException`이 아닌 예상치 못한 에러도 500 + `code: 'INTERNAL_SERVER_ERROR'`로 통일 응답(내부 메시지·스택은 노출하지 않고 서버 로그에만 기록). 프론트가 한글 메시지 텍스트 대신 `code`로 에러를 분기할 수 있게 됨.
- **재검토 트리거**: DB 제약 위반(unique violation 등)을 별도 상태 코드로 세분화해야 하는 케이스가 실제로 생기는 시점 → `AppException`에 TypeORM 에러 매핑 추가 검토.

### 10. 재고 부족 응답 → 200 + `valid: false` (409 아님)

- **배경**: `POST /orders/validate-stock`에서 재고가 부족할 때 어떤 상태 코드로 응답할지.
- **선택 근거**: `validate-stock`은 재고 유무를 확인하는 게 본래 목적이라 "부족함"도 정상 결과 중 하나로 본다. 200 + `valid: false`로 응답하면 프론트엔드가 이 경우를 예외 처리(catch)가 아닌 정상 분기 로직으로 다룰 수 있고, 실제 주문 생성 시점의 진짜 실패(409, 서버 재검증 시점의 타이밍 갭)와 명확히 구분된다.

### 11. 구현 순서 → 기능별 수직 슬라이스

- **비교한 대안**: 계층별 순서(Entity/Repository → Service → Controller 순으로 전체 완성), 리스크 우선순위(까다로운 부분부터 구현)
- **선택 근거**: 지금까지 기능 단위로 대안을 비교하고 블로그로 기록해온 흐름과 결이 맞음. 계층별로 가면 한동안 실제로 동작하는 기능이 하나도 없는 구간이 길어져, 혼자 개발하는 상황에서 문제 발생 시 원인 범위를 좁히기 어려움. 수직 슬라이스 안에서 슬라이스 순서를 리스크 기준으로 배치하면 리스크 우선순위 방식의 장점도 같이 가져갈 수 있음.
- **슬라이스 순서**:
  1. 상품 조회 (`GET /products`, `GET /products/:id`) — 다른 기능의 전제, 리스크 낮음
  2. 장바구니 (`GET/POST/PATCH/DELETE /cart`) — Redis 연동 최초 적용
  3. 재고 확인 (`POST /orders/validate-stock`) — 단순 조회, 락 없음
  4. 주문 생성 (`POST /orders`) — 비관적 락·트랜잭션 포함, 프로젝트 내 리스크가 가장 큰 지점. 동시 요청 테스트도 이 시점에 진행
  5. 주문 조회 (`GET /orders/lookup`) — 앞 단계 완료 후 진행

### 12. 프론트엔드 스택 → React (Vite)

- **비교한 대안**: Next.js, 순수 HTML/JS(Vanilla)
- **선택 근거**: 목표가 페이지 로딩 속도 개선이 아니라 백엔드 API의 동시성·성능을 검증하는 것이므로, Next.js의 SSR/SSG 강점은 이 목표와 어긋나며 오히려 "프론트 렌더링 시간 vs 백엔드 API 시간" 구분을 흐릴 수 있음. 화면이 상품/장바구니/주문/관리자 대시보드 등 여러 개로 나뉘고 대시보드는 실시간 갱신이 필요해 Vanilla는 상태 관리 부담이 큼. React는 ERP 프로젝트에서 이미 써본 경험이 있어 학습 비용이 없고, k6는 브라우저를 거치지 않고 API를 직접 호출하므로 React의 렌더링 방식과 무관하게 순수 API 응답시간 측정이 가능해 목적과 충돌하지 않음.

### 13. 부하테스트 목적 및 환경 → k6, 정확성 검증 중심

- **목적**: "비관적 락이 실제로 재고 초과 판매를 막는가"를 검증. (참고: 신뢰할 수 있는 성능 수치 기록이 목적이라면 별도 검토 필요 — 로컬 실행은 k6와 애플리케이션이 자원을 나눠 써서 자기간섭이 발생해 수치가 왜곡됨. 정확성 검증은 로컬 환경으로 충분하나, 정량적 성능 수치를 신뢰성 있게 남기려면 k6 실행 머신과 애플리케이션 서버를 분리한 배포 환경 필요.)
- **검증 방식**: 재고가 적은 상품에 동시 요청을 다수 전송, 성공/실패 개수와 최종 재고값이 의도한 대로 나오는지 확인.

### 14. 관리자 대시보드(재고 현황, 주문 상태) 추가

- **비교한 대안**: 기능 화면만 구현 (대시보드 없음)
- **선택 근거**: k6 부하테스트 동안 재고가 실시간으로 줄어드는 모습과 주문 상태 변화를 대시보드에서 직접 확인할 수 있어, 결정 13의 검증 목표(재고 초과 판매를 막는가)를 시각적으로 확인하고 스크린샷/화면 녹화로 기록하는 용도로 부합. (참고: 정확성 검증 자체는 k6 응답 로그만으로도 완료되므로, 대시보드는 검증의 필수 조건이 아니라 시각적 확인·기록을 위한 보조 도구임을 구분해서 인지)
- **구현**: `GET /admin/stock-overview`(재고 현황), `GET /admin/orders/recent`(최근 주문) API + `/admin` 화면. k6로 동시 주문을 실행하는 동안 새로고침 없이 재고가 줄어들고 신규 주문이 목록에 뜨는 것을 실제로 확인함.
- **인증**: 배포 전 `X-Admin-Token` 헤더 기반 `AdminGuard` 추가 완료 (결정 16 참고). SSE 엔드포인트는 `EventSource`가 커스텀 헤더 미지원으로 `?token=` 쿼리 파라미터 방식 병행.

### 15. 재고 실시간 갱신 방식 → Server-Sent Events (SSE)

- **비교한 대안**: 폴링(Polling), WebSocket
- **선택 근거**: 재고 파악이 목적이라 클라이언트가 서버로 별도 데이터를 보낼 필요가 없어 양방향 통신(WebSocket)은 불필요. 폴링은 갱신 주기보다 빠른 재고 변화를 놓칠 수 있어 "동시성 테스트 결과를 정확히 확인·기록한다"는 목표(결정 13, 14)에 부합하지 않음. SSE는 필요한 만큼(단방향 실시간)만 제공하면서 HTTP 기반이라 기존 REST API 인프라를 그대로 활용 가능.
- **구현**: NestJS `@Sse()` 데코레이터로 `GET /admin/events` 스트림 제공. `stock-update`(재고 변경), `order-update`(신규 주문 및 상태 변경) 두 종류의 이벤트를 이름으로 구분해 하나의 연결로 푸시. 주문 생성 트랜잭션이 커밋된 뒤에만 발행되도록 해서, 롤백된 시도는 대시보드에 노출되지 않음. 주문 상태 전이 API(`PATCH /admin/orders/:id/status`) 구현 후 같은 이벤트 채널(`common/events`의 `DomainEventsService`)을 재사용해 상태 변경도 실시간 반영함.
- **재검토 트리거**: 로그인 기능 도입 시점 → 사용자별 접근 제어로 확장.

---

## 모듈 구조

- **선택**: 대안 1 — 기능별 모듈(Feature Module). `src/products`, `src/cart`, `src/orders` 등 도메인 단위로 Controller/Service/Entity/DTO를 함께 배치.
- **근거**: 지금 계획한 수직 슬라이스 구현 순서와 폴더 구조가 일치해 탐색이 쉬움. 도메인이 2개뿐인 현재로서는 공통 코드로 뺄 게 거의 없어 선구조화가 불필요.
- **확장 계획**: Payment Orchestration, Ledger, 멀티 PG 등 도메인이 늘어나고 공통 로직(에러 필터, 인증 가드 등)이 실제로 중복되는 시점에 `common/` 폴더를 도입해 대안 3(도메인 모듈 + 공유 커널)으로 전환.

---

## API 명세

**공통**: 모든 장바구니/주문 요청에 `X-Cart-Id` 헤더 필요. 에러는 `{ statusCode, message, code }` 포맷 (결정 9 참고).

### 상품 (Products)

| Method | Path | 설명 |
|---|---|---|
| GET | `/products?category=` | 카테고리별 상품 목록 조회 |
| GET | `/products/:id` | 상품 상세 + 옵션(사이즈/색상별 재고) 조회 |

### 장바구니 (Cart)

Redis `cart:{cartId}` 해시(필드=`productOptionId`, 값=수량)로 저장, TTL 14일. 재고 검증은 하지 않고 옵션 존재 여부만 확인(없으면 404). `POST`/`PATCH`/`DELETE` 모두 응답으로 **갱신된 장바구니 전체**(`GET /cart`와 동일한 형태)를 반환 — 프론트가 매번 재조회하지 않고 응답으로 상태를 갱신할 수 있게 하기 위함.

| Method | Path | 설명 |
|---|---|---|
| GET | `/cart` | 현재 장바구니 조회. Response: `{ items: [{ productOptionId, productId, productName, size, color, unitPrice, quantity, stock, lineTotal }], totalAmount }` |
| POST | `/cart/items` | 장바구니에 상품 추가 (Request: `{ productOptionId, quantity }`, 이미 있으면 수량 누적). 404: 존재하지 않는 productOptionId |
| PATCH | `/cart/items/:productOptionId` | 수량 변경 (Request: `{ quantity }`, 1 이상). 404: 장바구니에 없는 항목 |
| DELETE | `/cart/items/:productOptionId` | 장바구니 항목 제거. 404: 장바구니에 없는 항목 |

### 주문 (Orders)

| Method | Path | 설명 |
|---|---|---|
| POST | `/orders/validate-stock` | 주문 전 재고 확인. 응답: `{ valid: boolean, insufficientItems?: [...] }` (항상 200) |
| POST | `/orders` | 실제 주문 생성. Request: `{ buyerEmail, buyerName, buyerPhone, buyerAddress, items: [{ productOptionId, quantity }] }`. Response 201: `{ orderNumber, status, totalAmount }`. 재검증 실패 시 409 |
| GET | `/orders/lookup?orderNumber=&email=` | 주문번호+이메일 조합 조회. 불일치 시 404 |

### 결제 (Payments)

| Method | Path | 설명 |
|---|---|---|
| POST | `/payments/confirm` | TossPayments 결제 승인. Request: `{ paymentKey, orderId, amount }`. 금액 검증 후 TossPayments 서버 승인 API 호출 → 주문 상태 PENDING → PAID. 금액 불일치 시 400 |

### 관리자 (Admin) — `X-Admin-Token` 헤더 인증 필요 (SSE는 `?token=` 쿼리 파라미터)

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/stock-overview` | 전체 상품 옵션의 현재 재고 목록 |
| GET | `/admin/orders/recent` | 최근 주문 목록 (최대 20건) |
| PATCH | `/admin/orders/:id/status` | 주문 상태 전이. body: `{ status }`. 유효하지 않은 전이 시 400 |
| GET | `/admin/events` | SSE. `stock-update`/`order-update` 이벤트를 이름으로 구분해 하나의 연결로 푸시 |

### 헬스체크 (Health) — 인증 불필요

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | DB(`SELECT 1`)·Redis(`PING`) 연결 상태 확인. 응답: `{ status: 'ok'\|'degraded', db: 'up'\|'down', redis: 'up'\|'down', timestamp }`. 둘 다 정상이면 200, 하나라도 실패하면 503 |

---

## 확정된 스키마

- `categories` → `products` → `product_options` (재고, 비관적 락 대상)
- `orders` (주문번호+이메일 조회 키) → `order_items` → `product_options`
- 장바구니는 DB 테이블이 아닌 Redis (`cart:{session_id}`)로 관리하며, 주문 생성 시점에만 `order_items`로 옮겨짐.
- 전체 DDL: `commerce-core-schema.sql` 참고 (ERD Cloud Import > DDL 로 시각화 가능).

```sql
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED');

CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    base_price INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE product_options (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    size VARCHAR(20) NOT NULL,
    color VARCHAR(30) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    sku VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(30) NOT NULL UNIQUE,
    status order_status NOT NULL DEFAULT 'PENDING',
    buyer_email VARCHAR(255) NOT NULL,
    buyer_name VARCHAR(100) NOT NULL,
    buyer_phone VARCHAR(30) NOT NULL,
    buyer_address VARCHAR(500) NOT NULL,
    total_amount INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_buyer_email ON orders(buyer_email);
CREATE INDEX idx_orders_order_number ON orders(order_number);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    product_option_id BIGINT NOT NULL REFERENCES product_options(id),
    quantity INTEGER NOT NULL,
    price_at_order INTEGER NOT NULL
);
```

---

## 구현 진행 로그

### 백엔드 환경 세팅

- NestJS 프로젝트 생성 완료 (`backend/`)
- `@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/config` 설치, `.env`로 DB 접속 정보 관리, `synchronize: false` (스키마는 SQL DDL로 직접 관리)
- **포트 충돌 이슈**: 로컬에 Grafana가 3000번 포트를 사용 중이라 NestJS 기본 포트와 충돌(`EADDRINUSE`). `.env`에 `PORT=3001` 추가, `main.ts`에서 `process.env.PORT ?? 3001`로 설정해 해결. 이후 모든 API 호출은 `http://localhost:3001` 기준.
- PostgreSQL 컨테이너 포트도 로컬 PostgreSQL과 충돌해 `5433:5432`로 매핑 (pgAdmin 접속 시 Port 5433 사용)
- 실시간 이벤트는 Kafka 없이 RxJS Subject(`DomainEventsService`)로 구현 — 단일 인스턴스 환경에서 SSE 스트림에 충분함

### 22. 색상(color) 값 표기 → 한글로 통일

- **배경**: 초기 테스트 데이터를 넣는 과정에서 `color` 값이 영어(`BLACK`, `WHITE`)와 한글(`블랙`, `화이트`)로 혼재됨. `VARCHAR`라 DB 제약상 에러는 안 나지만, 필터링/조회 시 같은 색상이 다른 값으로 취급되는 문제가 있음.
- **비교한 대안**: 영어로 통일 + 프론트엔드에서 한글 매핑 테이블 관리
- **선택 근거**: 카테고리 3개·상품 30개로 한정된 초기 규모에서는 관리자(본인)가 직접 데이터를 입력하므로 별도 매핑 계층이 불필요. 한글로 통일하면 프론트엔드에 그대로 노출 가능해 번역 로직이 필요 없음.
- **재검토 트리거**: 국제화(i18n)가 필요해지는 시점 → 영어 코드 값 + 다국어 매핑 방식으로 전환 검토.
- **기존 데이터 수정**: `UPDATE product_options SET color = '블랙' WHERE color = 'BLACK'; UPDATE product_options SET color = '화이트' WHERE color = 'WHITE';`

### 23. 헬스체크 → DB/Redis 의존성 직접 확인 (`@nestjs/terminus` 미도입)

- **배경**: 관측성 축이 비어 있던 것을 확인 — 앱이 살아있는지, DB/Redis 연결이 정상인지 확인할 방법이 응답 지연 관찰 외엔 없었음. Render 무료 티어는 15분 비활성 후 슬립되고 재기동에 30초 정도 걸림.
- **비교한 대안**: (a) 단순 liveness(항상 200) — 프로세스 생존만 확인, DB/Redis 장애를 못 잡아 의미가 약함. (b) `@nestjs/terminus` 도입 — 표준적이지만 헬스체크 항목이 DB+Redis 둘뿐인 지금 규모엔 새 의존성이 과함.
- **선택 근거**: 기존 TypeORM `DataSource`(`SELECT 1`)와 기존 Redis 클라이언트(`PING`)를 직접 사용해 의존성 상태를 확인. 새 패키지 추가 없이 구현 가능.
- **구현**: `GET /health` (인증 불필요, `AdminGuard` 미적용) — 둘 다 정상이면 200 + `status: 'ok'`, 하나라도 실패하면 503 + `status: 'degraded'`.
- **재검토 트리거**: 헬스체크 항목이 늘어나거나(외부 PG 연동 등) 여러 인스턴스로 확장되는 시점 → `@nestjs/terminus` 등 표준 라이브러리 전환 검토.

### 24. 요청 로깅 → NestJS 기본 Logger (구조화 로깅 라이브러리 미도입)

- **배경**: `backend/src` 전체에 `Logger` 사용이 0건이라 요청 단위 추적이 불가능했음.
- **비교한 대안**: Winston/pino 등으로 JSON 구조화 로깅.
- **선택 근거**: 로그 수집·분석 플랫폼이 없는 현재 단계에서는 텍스트 한 줄 로그로 충분. 새 의존성 없이 NestJS 기본 `Logger`로 구현 가능.
- **구현**: `common/interceptors/logging.interceptor.ts`를 전역 등록(`main.ts`). 모든 요청에 `{METHOD} {URL} {상태코드} {소요시간}ms` 형식으로 성공/실패 모두 기록.
- **재검토 트리거**: 로그 수집·분석 플랫폼(예: Datadog, CloudWatch)을 도입하는 시점 → JSON 구조화 로깅으로 전환 검토.

### 테스트 데이터

- `categories`: 신발, 상의, 하의
- `products`: 5개 상품 등록 완료 (에어맥스 90, 베이직 반팔티 외 3종 추가)
- `product_options`: 10개 옵션 등록 완료
  - 재고 1개로 설정한 옵션 존재 (동시성 락 테스트용)
  - 재고 0개로 설정한 옵션 존재 (품절 응답 테스트용)
  - color 값은 한글로 통일 완료

---

## 블로그 시리즈 진행 상황

시리즈명: "이커머스 핵심기능 (주문관리/상품 카탈로그,장바구니)" @ 쪼정뱅이개발일지 (Tistory)

- **-1편** (핵심 기능 결정 4가지): 게시 완료 — https://gussdndlek12.tistory.com/9
- **-2편** (ERD~API 명세, 설계 구체화 과정에서 드러난 것들): 게시 완료 — https://gussdndlek12.tistory.com/10
- **-3편** (구현+검증): 게시 완료 — https://gussdndlek12.tistory.com/20
- **이후 규칙**: 앞으로 추가할 기능도 동일하게 "구현 + 검증까지 끝난 시점에 한 편"으로 작성. 결정 단계·구체화 단계마다 나눠 쓰지 않고 기능 단위로 압축.
- **다음 편 트리거**: Ledger 또는 멀티 PG Orchestration 구현+검증 완료 시점

---

## 다음 단계

1. ~~핵심 기능 선정 (주문 관리, 상품 카탈로그/장바구니)~~ ✅
2. ~~설계 대안 비교 및 결정~~ ✅
3. ~~테이블 구조 설계 (ERD/DDL)~~ ✅
4. ~~API 명세 작성~~ ✅
5. ~~구현 순서 확정 (기능별 수직 슬라이스)~~ ✅
6. ~~프론트엔드 스택 및 성능 검증 방식 결정~~ ✅
7. ~~모듈 구조 및 재고 실시간 갱신 방식 결정~~ ✅
8. ~~백엔드 환경 세팅 (NestJS, TypeORM, Docker Compose, 포트 충돌 해결)~~ ✅
9. ~~테스트 데이터 입력 및 컨벤션 정리 (색상 한글 통일)~~ ✅
10. ~~상품 조회 슬라이스 API 구현 완료 여부 확인 (Postman으로 `GET /products`, `GET /products/:id` 응답 검증)~~ ✅
11. ~~프론트엔드(React) 연결 — 상품 목록/상세 화면~~ ✅
12. ~~장바구니 슬라이스 구현 (Redis, `GET/POST/PATCH/DELETE /cart*`) — 프론트엔드 연결까지 완료~~ ✅
13. ~~재고 확인 슬라이스 (`POST /orders/validate-stock`)~~ ✅
14. ~~주문 생성 슬라이스 (`POST /orders`, 비관적 락 + 트랜잭션)~~ ✅
15. ~~주문 조회 슬라이스 (`GET /orders/lookup`)~~ ✅
16. ~~k6 부하테스트로 동시성 정확성 검증 및 기록~~ ✅ (성공 1건/실패 9건, 최종 재고 0 확인)
17. ~~블로그 -3편 작성 (구현+검증)~~ ✅ — https://gussdndlek12.tistory.com/20
18. ~~관리자 대시보드(재고 현황, 주문 상태) + SSE 실시간 갱신 구현 (결정 14, 15)~~ ✅
19. ~~관리자 인증 (`X-Admin-Token` Guard, SSE는 `?token=` 쿼리 파라미터)~~ ✅
20. ~~배포 완료 (Render + Supabase + Upstash + Cloudflare Pages)~~ ✅ — 2026-08-16
21. ~~TossPayments 단일 PG 결제 연동 (POST /payments/confirm, 결제창 흐름 구현)~~ ✅ — 2026-08-16
22. 다음 기능 검토 중 — Double-entry Ledger, 멀티 PG Orchestration (PortOne 추가)
