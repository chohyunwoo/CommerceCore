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

**공통**: 모든 장바구니/주문 요청에 `X-Cart-Id` 헤더 필요, 로그인 사용자 요청은 `X-Session-Token` 헤더 필요(결정 35). 에러는 `{ statusCode, message, code }` 포맷 (결정 9 참고).

### 상품 (Products)

| Method | Path | 설명 |
|---|---|---|
| GET | `/products?category=&page=&limit=` | 카테고리별 상품 목록 조회 (페이지네이션) |
| GET | `/products/:id` | 상품 상세 + 옵션(사이즈/색상별 재고) 조회 |
| POST | `/products/search-by-image` | 이미지 기반 상품 시각적 유사도 검색 (결정 32). Request: `{ embedding: number[] }`(클라이언트에서 CLIP으로 계산). Response: 코사인 유사도 상위 5개(`MIN_SIMILARITY=0.5` 미만 제외) |

### 장바구니 (Cart)

게스트는 Redis `cart:{cartId}` 해시(필드=`productOptionId`, 값=수량)로 저장, TTL 14일. **로그인 사용자(`X-Session-Token` 유효)는 DB `cart_items` 테이블로 영구 보관**(결정 36) — 같은 엔드포인트가 세션 유무에 따라 저장소만 분기하고 API 형태는 동일. 재고 검증은 하지 않고 옵션 존재 여부만 확인(없으면 404). `POST`/`PATCH`/`DELETE` 모두 응답으로 **갱신된 장바구니 전체**(`GET /cart`와 동일한 형태)를 반환 — 프론트가 매번 재조회하지 않고 응답으로 상태를 갱신할 수 있게 하기 위함.

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
| POST | `/orders` | 실제 주문 생성. Request: `{ buyerEmail, buyerName, buyerPhone, buyerAddress, items: [{ productOptionId, quantity }] }`. Response 201: `{ orderNumber, status, totalAmount }`. `X-Session-Token`이 유효하면 `order.userId`를 자동 기록(결정 37). 재검증 실패 시 409 |
| GET | `/orders/lookup?orderNumber=&email=` | 주문번호+이메일 조합 조회(게스트). 응답에 `trackingNumber`/`carrier`/`deliveryEvents`(배송 단계 타임라인) 포함(결정 33). 불일치 시 404 |
| GET | `/orders/my?page=&limit=` | 로그인 필요. 내 주문 목록. 응답: `{ items, total, page, totalPages }`(`GET /products`와 동일 컨벤션, 결정 37) |
| GET | `/orders/my/:orderNumber` | 로그인 필요. 내 주문 상세(품목, 배송 타임라인). 다른 사용자의 주문이면 404(존재 여부 비노출, 결정 37) |

### 결제 (Payments)

| Method | Path | 설명 |
|---|---|---|
| POST | `/payments/confirm` | TossPayments 결제 승인. Request: `{ paymentKey, orderId, amount }`. 금액 검증 후 TossPayments 서버 승인 API 호출 → 주문 상태 PENDING → PAID. 금액 불일치 시 400 |

### 회원 (Auth)

| Method | Path | 설명 |
|---|---|---|
| POST | `/auth/register` | 회원가입. Request: `{ email, password, name }`. 비밀번호는 bcryptjs로 해싱 저장. 성공 시 즉시 세션 발급(로그인 상태). `X-Cart-Id`가 있으면 게스트 장바구니를 병합(결정 36). 이메일 중복 시 409 `EMAIL_ALREADY_EXISTS` |
| POST | `/auth/login` | 로그인. Request: `{ email, password }`. `X-Cart-Id`가 있으면 게스트 장바구니를 병합(결정 36). 실패 시 401 `INVALID_CREDENTIALS`(이메일/비밀번호 구분 없이 동일 메시지) |
| POST | `/auth/logout` | `X-Session-Token` 헤더로 세션 파기(Redis 키 삭제, 멱등적) |
| GET | `/auth/me` | `X-Session-Token`으로 현재 로그인 사용자 조회. 세션 없음/만료 시 401 `SESSION_REQUIRED` |

### 관리자 (Admin) — `X-Session-Token` 헤더 + role=admin 세션 필요(결정 38). SSE는 1회용 단기 티켓을 `?ticket=` 쿼리 파라미터로 전달

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/stock-overview` | 전체 상품 옵션의 현재 재고 목록. 카테고리 순으로 정렬되어 반환(결정 34), `categoryName` 포함 |
| GET | `/admin/orders/recent?status=&page=&limit=&search=` | 주문 목록. `status`(선택)로 필터링, `search`(선택)로 `buyerName`/`buyerEmail` 부분 일치 검색(결정 38), `page`/`limit`(기본 1/20)로 페이지네이션. 응답: `{ items, total, page, totalPages }`(`GET /products`와 동일 컨벤션, 결정 34) |
| PATCH | `/admin/orders/:id/status` | 주문 상태 전이. body: `{ status }`. 유효하지 않은 전이 시 400. PAID→CANCELLED는 TossPayments 결제취소 API 호출 후 성공해야 전이됨(결정 26) — 실패 시 400 `PAYMENT_CANCEL_FAILED`, 상태 변경 없음. PAID→SHIPPED는 `trackingNumber`/`carrier`가 body에 필수(결정 33). **SHIPPED→DELIVERED는 이 API로 직접 전이 불가** — 아래 `delivery-events`로만 진행됨 |
| POST | `/admin/orders/:id/delivery-events` | 배송 단계 기록(결정 33). body: `{ stage, location? }`. `stage`는 `COLLECTED`→`IN_TRANSIT`→`OUT_FOR_DELIVERY`→`DELIVERED` 순서로만 기록 가능(건너뛰거나 중복 시 400). SHIPPED 상태의 주문에만 가능(그 외 400). `DELIVERED` 기록 시 주문 status도 자동으로 DELIVERED 전이 |
| POST | `/admin/events/ticket` | SSE 연결용 1회용 단기 티켓 발급(TTL 30초, Redis). 응답: `{ ticket }`. `EventSource`가 커스텀 헤더를 못 보내 세션 토큰 대신 이 티켓을 아래 `/admin/events`에 쿼리로 전달한다(결정 38) |
| GET | `/admin/events?ticket=` | SSE. `stock-update`/`order-update` 이벤트를 이름으로 구분해 하나의 연결로 푸시. `order-update`에는 배송 단계 변경도 포함됨(결정 33). `ticket`은 검증 즉시 소모되어 1회만 사용 가능(결정 38) — `AdminGuard`가 아닌 `AdminSseGuard`로 별도 보호 |

### 헬스체크 (Health) — 인증 불필요

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | DB(`SELECT 1`)·Redis(`PING`) 연결 상태 확인. 응답: `{ status: 'ok'\|'degraded', db: 'up'\|'down', redis: 'up'\|'down', timestamp }`. 둘 다 정상이면 200, 하나라도 실패하면 503 |

---

## 확정된 스키마

- `categories` → `products` → `product_options` (재고, 비관적 락 대상)
- `orders` (주문번호+이메일 조회 키) → `order_items` → `product_options`. `user_id`(nullable FK) — 로그인 사용자가 주문하면 채워지고, 게스트 체크아웃(결정 6)은 계속 null(결정 37).
- 장바구니는 DB 테이블이 아닌 Redis (`cart:{session_id}`)로 관리하며, 주문 생성 시점에만 `order_items`로 옮겨짐.
- `users`(id, email UNIQUE, password_hash, name) — 로그인 세션은 DB가 아닌 Redis(`session:{token}`)로 관리(결정 35). `cart_items`(user_id, product_option_id, quantity, unique(user_id, product_option_id))로 로그인 사용자 장바구니만 연결됨(결정 36) — 게스트 장바구니는 여전히 Redis.
- 전체 DDL: `commerce-core-schema.sql` 참고 (ERD Cloud Import > DDL 로 시각화 가능). `users`는 이후 마이그레이션(`CreateUsers`)으로 추가된 것이라 이 스냅샷엔 없음 — 결정 29대로 `src/migrations/`가 기준.

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

### 25. TossPayments 승인 신뢰성 강화 → 타임아웃·재시도·멱등성·동시성 락

- **배경**: `PaymentsService.confirm()`이 순수 `fetch()` 1회 호출뿐이라 타임아웃이 없고, 네트워크 실패·Toss 5xx에도 재시도가 없고, 동일 주문에 동시에 confirm 요청이 두 번 들어오면(더블클릭, 프론트 재시도) 둘 다 `order.status !== PENDING` 체크를 통과해 Toss confirm을 중복 호출할 수 있는 레이스가 있었음.
- **타임아웃/재시도 기준**: TossPayments 공식 문서(docs.tosspayments.com/reference/error-codes)에 명시적 재시도 가이드가 없음을 확인(2026-08-18). `AbortController` 기반 10초 타임아웃 적용, 네트워크 에러/타임아웃과 5xx 응답에 한해 최대 2회 재시도(백오프 300ms, 900ms). 4xx는 멱등하지 않은 클라이언트 에러로 간주해 재시도하지 않음.
- **멱등성**: Toss가 이미 승인된 결제 재요청 시 반환하는 공식 에러 코드 `ALREADY_PROCESSED_PAYMENT`(400)를 실패가 아닌 성공(멱등)으로 처리 — 우리 쪽 재시도나 클라이언트 재요청이 Toss 측에서 이미 처리된 결제와 마주쳐도 주문을 PAID로 정상 동기화.
- **동시 confirm 레이스 방지 — 비교한 대안**: (a) 별도 `PROCESSING` 상태 컬럼/값 추가 후 원자적 업데이트로 선점 — 락을 오래 안 쥐어 확장성은 좋으나 스키마 변경(마이그레이션 도구 없음, Supabase SQL 수동 실행 필요)이 필요해 지금 규모엔 과함. (b) `orders.service.ts`의 `createOrder()`와 동일한 `pessimistic_write` 트랜잭션 락 재사용 — 새 스키마 없이 가능.
- **선택 근거**: (b). 결정 2(재고 동시성 제어에 비관적 락 선택)와 같은 판단 기준 — 현재 트래픽 규모에서는 락 대기로 인한 지연보다 정확성이 우선. 다만 락을 쥔 채로 외부 API(Toss)를 호출하는 트레이드오프가 있음을 인지하고 채택.
- **재검토 트리거**: 결제 동시 요청이 늘어나 락 대기가 체감되는 시점 → (a) 원자적 상태 컬럼 방식으로 전환 검토.
- **테스트 범위**: 실제 DB 락 동시성 검증은 이미 `k6/order-concurrency.js`가 담당 중이라 중복하지 않음. `OrdersService`/`PaymentsService` 유닛테스트는 Repository/DataSource/Redis/`fetch`를 모킹해 비즈니스 로직(금액 계산, 재시도/멱등 분기, 에러 매핑, 상태 가드)만 검증 — 역할을 분리함.

### 26. 프로덕션 버그 수정 — 이메일 대소문자 불일치 + 관리자 취소 시 Toss 미연동

- **배경**: 배포 후 두 가지 문제 발견(2026-08-18). (1) `lookupOrder`가 `buyerEmail`을 정규화 없이 정확 일치로 비교해, 결제 시 입력한 이메일과 조회 시 입력한 이메일의 대소문자가 다르면 존재하는 주문도 404로 응답(`ORD-20260818-4BP43U`로 실제 재현 확인). (2) 관리자 주문 취소가 DB `status`만 바꾸고 TossPayments 쪽엔 아무 취소 요청도 보내지 않음 — `Order`에 `paymentKey`를 저장하는 컬럼 자체가 없어 애초에 불가능한 상태였음.
- **이메일 정규화**: `CreateOrderDto.buyerEmail`, `LookupOrderQueryDto.email`에 `@Transform`으로 trim+lowercase 적용. 기존 데이터는 `UPDATE orders SET buyer_email = LOWER(TRIM(buyer_email));`로 백필(결정 22와 동일 방식, Supabase SQL 수동 실행).
- **Toss 취소 연동**: `orders.payment_key` 컬럼 추가(nullable — PENDING으로 끝난 주문은 결제 자체가 없어 값이 없음). `PaymentsService.confirm()`이 승인 성공 시 `paymentKey`를 저장하고, 신규 `PaymentsService.cancel(paymentKey, reason)`이 Toss 취소 API(`POST /v1/payments/{paymentKey}/cancel`)를 호출. `AdminService.updateOrderStatus()`를 트랜잭션 + `pessimistic_write` 락으로 감싸(기존엔 락이 전혀 없어 동시 상태변경 레이스도 방치돼 있었음) PAID→CANCELLED 전이 시 Toss 취소를 먼저 호출하고, 실패하면 예외를 던져 트랜잭션을 롤백— DB 상태도 그대로 유지됨(취소 사유는 고정 문구 사용, 관리자 입력 UI는 아직 없음).
- **레거시 주문 처리**: 이 기능 배포 이전에 이미 PAID된 주문(`payment_key`가 NULL)은 자동 취소가 불가능하므로, 추측으로 처리하지 않고 명확한 에러로 막아 수동 확인을 안내함.
- **Idempotency-Key 공식 메커니즘 발견**: TossPayments 전체 POST API가 `Idempotency-Key` 헤더를 지원하며(15일 유효), 같은 키로 재요청 시 최초 응답을 그대로 반환해 중복 처리를 막아줌을 확인(2026-08-18, 공식 문서). 기존 PR(#29)의 confirm 멱등성 처리는 `ALREADY_PROCESSED_PAYMENT` 에러 코드 감지 방식뿐이었는데, 이 공식 헤더를 놓치고 있었음이 드러남. 이번에 confirm(`Idempotency-Key: confirm:{orderId}`)과 cancel(`Idempotency-Key: cancel:{paymentKey}`) 모두에 적용. 기존 에러 코드 감지는 보조 안전망으로 유지. 타임아웃·재시도·Idempotency-Key 로직은 `requestTossWithRetry()` 공통 헬퍼로 추출해 confirm/cancel이 공유.
- **재검토 트리거**: 레거시(paymentKey 없는) PAID 주문이 다수 발생하면 → Toss 결제 조회 API(`GET /v1/payments/orders/{orderId}`)로 paymentKey를 소급 조회해 백필하는 스크립트 검토. 관리자가 취소 사유를 직접 입력해야 할 필요가 생기면 → `UpdateOrderStatusDto`에 `reason` 필드 추가 + 프론트 UI 확장 검토.

### 27. GitHub Actions CI 도입 — typecheck/lint/unit/e2e 자동화

- **배경**: 결정 26의 `payment_key` 컬럼을 `string | null` 유니온 타입으로 선언했다가 TypeORM이 컬럼 타입을 `Object`로 오인식해 Render 배포가 크래시 루프에 빠짐(PR #31 → 긴급 핫픽스 PR #32). 유닛테스트는 `DataSource`를 모킹하므로 이런 엔티티 메타데이터 오류를 원천적으로 못 잡음. 반면 이미 있던 `test/app.e2e-spec.ts`는 `AppModule`을 실제로 부팅(`app.init()`)하는 진짜 e2e 테스트라 이 버그를 그대로 잡아낼 수 있었는데, CI가 없어 커밋 전에 아무도 실행하지 않았음.
- **비교한 대안**: (a) Docker 이미지 빌드까지 CI에 포함해 Render와 완전히 동일하게 검증 — 가장 확실하지만 지금 필요한 수준(엔티티/부팅 오류 조기 발견)을 넘어서는 과설계. (b) typecheck+lint+unit+e2e까지만.
- **선택 근거**: (b). e2e 단계(`test/app.e2e-spec.ts`)가 오늘 사고의 근본 원인을 정확히 잡아내므로 목적에 충분.
- **구현**: `.github/workflows/ci.yml` — `pull_request`(대상 `main`) 트리거, Postgres 16·Redis 7을 GitHub Actions `services`로 띄우고 스키마를 적재한 뒤 typecheck → lint → unit test → e2e test 순으로 실행. 로컬 재현 검증: `Order.paymentKey`를 일부러 다시 유니온 타입으로 되돌려 `npm run test:e2e` 실행 → 동일한 `DataTypeNotSupportedError`로 실패 확인, 원상 복구 후 재검증 통과 확인(2026-08-18).
- **2026-08-18 갱신**: `push: branches: [main]` 트리거 제거. 일반 머지 커밋은 PR 브랜치 끝과 코드가 완전히 동일해 머지 직후 다시 도는 `push` 트리거가 이미 통과 확인한 것을 중복 실행하는 낭비였음(이 프로젝트는 항상 PR을 거쳐 머지하므로 직접 push 안전망이 불필요). `pull_request`만 남김.
- **부수 발견**: `test:e2e`가 테스트 통과 후에도 종료되지 않는 문제 발견(Redis 클라이언트 커넥션이 `app.close()`로 안 닫힘) — CI에서 행(hang)을 방지하기 위해 `--forceExit` 플래그 추가.
- **재검토 트리거**: Docker 기반 배포와의 차이로 인한 사고가 또 발생하면 → CI에 실제 Docker 빌드 단계 추가 검토. Redis 커넥션을 `OnModuleDestroy`로 정식 종료하는 방식으로 전환하면 `--forceExit` 제거 검토.

### 28. Swagger/OpenAPI 문서화 도입

- **배경**: API 설계 축에서 DTO+class-validator는 갖춰져 있었지만 자동화된 API 명세가 없어, CLAUDE.md의 수기 표만으로 산출물을 대신하고 있었음.
- **비교한 대안**: (a) 별도 OpenAPI yaml/json 수동 작성 — 코드와 별도로 관리해야 해 실제 동작과 문서가 어긋날 위험. (b) `@nestjs/swagger` 데코레이터 방식.
- **선택 근거**: (b). 코드가 곧 명세라 어긋날 위험이 낮고, 이미 있는 DTO 구조에 `@ApiProperty` 추가하는 수준의 낮은 비용.
- **구현**: `main.ts`에 `SwaggerModule` 설정, `GET /docs`에서 Swagger UI 제공. 모든 DTO에 `@ApiProperty`, 모든 컨트롤러에 `@ApiTags`/`@ApiOperation` 추가. `X-Cart-Id`/`X-Session-Token` 커스텀 헤더는 `DocumentBuilder.addApiKey()`로 보안 스킴 등록해 Swagger UI "Authorize" 버튼으로 테스트 가능(관리자 인증이 정적 토큰에서 세션 기반으로 바뀌며 `X-Admin-Token` 스킴은 제거됨, 결정 38). 배포 환경에도 별도 게이팅 없이 그대로 노출(민감 정보 없는 API 구조 문서라 포트폴리오 열람 목적에 부합).
- **재검토 트리거**: API에 민감한 내부 정보가 노출되기 시작하면 → 환경변수로 프로덕션 노출 여부 게이팅 검토.

### 29. TypeORM 마이그레이션 도입

- **배경**: `synchronize: false`는 맞지만, 스키마 변경(가장 최근엔 `payment_key` 컬럼 추가)을 전부 Supabase SQL Editor에 수동 SQL로 처리해왔음 — "스키마 변경 이력 관리"로 보기 어렵고, 로컬/CI/프로덕션 세 환경의 스키마가 실제로 동일한지 보장할 방법이 없었음.
- **비교한 대안**: (a) `synchronize: true`로 전환 — 프로덕션에서 예측 불가능한 자동 스키마 변경·데이터 손실 위험 있어 기각(결정 4/22와 동일 기준). (b) TypeORM 마이그레이션 도입.
- **선택 근거**: (b). `npm run migration:generate`/`migration:run`/`migration:revert` 스크립트 추가(`typeorm-ts-node-commonjs` CLI, 새 패키지 설치 불필요 — `dotenv`만 명시적 의존성으로 추가).
- **구현 — 안전한 편입 전략**: 초기 마이그레이션(`src/migrations/*-InitialSchema.ts`)을 `commerce-core-schema.sql` 기준으로 작성하되 `CREATE TABLE IF NOT EXISTS`/`CREATE TYPE ... EXCEPTION WHEN duplicate_object`/`ADD COLUMN IF NOT EXISTS` 등으로 **멱등적으로** 작성. 빈 DB(CI)에서는 실제로 스키마를 생성하고, 이미 스키마가 있는 환경(로컬/프로덕션)에서는 아무것도 바꾸지 않고 마이그레이션 이력에만 편입됨 — 로컬 DB에 실행해 기존 데이터(상품/주문) 그대로 유지되는 것, 빈 DB에 실행해 6개 테이블이 정상 생성되는 것 모두 직접 검증함(2026-08-18).
- CI(`ci.yml`)의 "Load schema" 단계를 `npm run migration:run`으로 교체해 마이그레이션 자체가 매 PR마다 검증되도록 함. `commerce-core-schema.sql`은 삭제하지 않고 ERD 시각화용 참고 스냅샷으로 유지, 상단에 "이제 `src/migrations/`가 기준"이라는 안내 추가.
- **`migrationsRun: true`(앱 부팅 시 자동 실행)는 이번엔 켜지지 않음** — 결정 26/27의 배포 크래시를 겪은 직후라, 자동 실행까지 한 번에 붙이는 건 리스크를 늘린다고 판단. 당분간 `npm run migration:run` 수동 실행으로 검증 기간을 둠.
- **재검토 트리거**: 마이그레이션 워크플로우가 몇 번의 실제 스키마 변경을 거쳐 안정성이 검증되면 → `migrationsRun: true`로 전환해 배포 시 자동 적용 검토.

### 30. Rate limiting(@nestjs/throttler) + 상품 조회 응답 캐싱

- **배경**: "성능·확장성" 축에서 요청 한도와 응답 캐싱이 전혀 없었음. 트래픽 규모상 실익은 적지만 항목 자체가 없다는 게 감점 요인.
- **Rate limiting**: `@nestjs/throttler`를 `APP_GUARD`로 전역 등록, IP당 60초에 100회 기본 제한. `HealthController`는 `@SkipThrottle()`로 제외(업타임 모니터링이 자유롭게 호출해야 함). 로컬에서 101회 연속 요청 시 100번째까지 200, 101번째부터 429 확인. k6 `order-concurrency.js`(VU 10, 총 10 요청)는 기존과 동일하게 성공 1/충돌 9로 통과해 rate limit이 동시성 테스트를 방해하지 않음을 확인(2026-08-18).
- **응답 캐싱**: `@nestjs/cache-manager`(인메모리) 도입, `ProductsModule`에만 등록. `GET /products`, `GET /products/:id` 두 엔드포인트에만 `CacheInterceptor` + TTL 30초 적용.
- **캐싱 범위를 상품 조회로 한정한 이유**: `/cart`에 전역 캐싱을 걸면 캐시 키가 URL 기준이라 `X-Cart-Id`로 사용자를 구분하는 로직과 충돌해 서로 다른 사용자의 장바구니 응답이 섞이는 버그가 생길 수 있음(설계 검토 중 발견). `/admin/*`은 실시간 모니터링 목적과 충돌, `/orders/lookup`은 결제 상태 등 실시간성이 중요해 제외. 실제로 DB 값을 직접 바꾼 뒤 즉시 재조회해 캐시된 이전 값이 반환되는 것, 서로 다른 `X-Cart-Id`로 `/cart` 조회 시 섞이지 않는 것 모두 검증함.
- **비교한 대안(캐시 저장소)**: (a) 인메모리, (b) Redis 기반(이미 인프라 있음). **선택**: (a) — 단일 인스턴스 배포라 공유 캐시가 불필요(결정 3과 동일 판단 기준).
- **재검토 트리거**: 실제 트래픽 패턴 분석 후 특정 엔드포인트에 더 엄격한 제한이 필요해지면 → 라우트별 세분화 검토. 여러 인스턴스로 확장되면 → Redis 기반 공유 캐시로 전환.

### 31. 성능 병목 진단(P2-1) → 증거 기반 가설-검증-반증 반복, 쿼리 분리로 해결

- **배경**: VU(가상 사용자) 수를 늘려도 `GET /orders/lookup`(캐싱·락 없는 순수 조회, 항상 실제 DB 쿼리 발생) 처리량이 거의 늘지 않고 p95 응답시간만 3배 이상 치솟는 포화 패턴 발견(VU 10/20/30: 32.5/34.5/42.6 req/s, p95 509ms/1.38s/1.69s). 원인을 추측으로 단정하지 않고 후보를 나열한 뒤 하나씩 실측으로 검증하는 방식으로 진행.
- **가설 1 (DB 커넥션 풀 부족, 기본값 10)**: `DB_POOL_MAX` 환경변수를 20으로 올려 A/B 재측정. VU30 기준 42.6→35.5 req/s로 오히려 소폭 악화 → **반증**.
- **가설 2 (쿼리 자체가 느림, 3단계 JOIN 비용)**: Node/TypeORM을 거치지 않고 Supabase에 동일 쿼리를 직접 `EXPLAIN ANALYZE`로 실행. 실행시간 0.479ms, order_items JOIN은 "never executed"(orders 필터링 단계에서 이미 0건이라 JOIN 자체가 실행 안 됨) → **반증**.
- **비교 테스트**: 같은 VU로 캐싱 없는 단순 조회 엔드포인트 `/health`를 동시에 측정. `/health`는 VU 증가에 비례해 처리량이 늘었지만(47→79→101 req/s), `/orders/lookup`만 정체 → 전역 CPU 부족이 아니라 **라우트별 처리 비용 차이**임을 시사.
- **원인 특정**: 남은 설명은 TypeORM이 매 요청마다 4개 엔티티(orders→order_items→product_options→products)에 걸친 관계(relations)를 조립하는 애플리케이션 레벨 CPU 비용. Render 무료 티어(0.1 vCPU)에서 이 비용이 누적되며 병목이 됨.
- **개선**: `lookupOrder()`를 "존재 확인(단순 쿼리)" → "존재할 때만 관계 조회"의 2단계로 분리(`backend/src/orders/orders.service.ts`). 개선 후 VU30 기준 처리량 42.6→68.4 req/s(+60%), p95 1.69s→1.05s(-38%) 확인.
- **한계**: TypeORM 쿼리 빌더 자체의 비용인지 검증 파이프라인 등 다른 요소인지 더 세분화하려면 유료 APM/프로파일러가 필요 — 블랙박스 k6 테스트로 확인 가능한 범위는 여기까지임을 인지.
- **재검토 트리거**: 유료 인스턴스로 전환하거나 APM 도입 시 → 더 정밀한 프로파일링으로 재검증.

### 32. 이미지 기반 상품 시각적 유사도 검색 (AI 기능) → 클라이언트사이드 자체 호스팅 CLIP 임베딩

- **배경**: 사용자가 이미지를 업로드하면 시각적으로 가장 유사한 상품을 찾아주는 기능 검토. 목표는 카테고리/속성 매칭이 아니라 진짜 이미지 시각적 유사도 매칭. 상품 규모는 최소 50개로 가정.
- **비교한 대안**:
  - (a) Vision LLM 원샷 비교 — 업로드 이미지 + 카탈로그 이미지 전체를 프롬프트 하나에 넣어 가장 유사한 것을 고르게 함. 새 인프라는 필요 없지만 상품 수만큼 매 요청마다 참조 이미지를 다시 전송해야 해서, 50개 이상 규모에서는 요청당 비용·지연이 계속 누적됨.
  - (b) Vision LLM 속성 추출 + 기존 필터 쿼리 — 이미지를 보고 카테고리/색상 등 속성만 추출해 `product_options` 필터로 넘김. 참조 이미지가 필요 없어 가장 가볍지만 "속성이 같다" 수준이라 진짜 시각적 유사도 목표에는 못 미침.
  - (c) 임베딩 기반 유사도 검색(호스팅 API, 예: Voyage AI `multimodal-3`/Cohere `embed-v4`) — 상품 이미지 임베딩을 등록 시 1회만 계산해두고 코사인 유사도로 비교. 카탈로그가 커져도 요청당 비용이 거의 그대로 유지되는 표준적 방식.
  - (d) 임베딩 기반 유사도 검색(자체 호스팅 CLIP, 서버사이드) — `transformers.js`를 NestJS 백엔드에서 실행. 외부 API 비용은 없지만 Render 무료 티어(0.1 vCPU, 결정 31에서 이미 병목 원인으로 확인됨)에 임베딩 추론 부하까지 얹는 구조.
  - (e) 임베딩 기반 유사도 검색(자체 호스팅 CLIP, 클라이언트사이드) — `transformers.js`를 React 프론트엔드(브라우저)에서 실행해 업로드 이미지 임베딩을 계산하고, 서버는 코사인 유사도 계산만 담당.
- **비용 검토**: (c) 호스팅 API 기준, 상품 사진을 약 100만 픽셀로 가정하면 Voyage AI는 이미지 1장당 약 $0.0006, 상품 50개 카탈로그 임베딩 1회 비용은 약 $0.03 수준이며 계정당 무료 제공량(150B 픽셀)만으로도 이 규모는 사실상 소진되지 않음(2026-08-19 확인). 다만 "비용을 무조건 무료로" 유지하고 싶다는 요구가 있어, 외부 API 의존 자체를 배제하는 방향으로 결정.
- **선택 근거**: (e). 시각적 유사도가 목표이므로 속성 매칭 방식인 (b)는 제외. 상품 50개 규모에서 (a)의 원샷 비교는 요청마다 커지는 비용·지연 구조라 부적합. 외부 API 비용을 무조건 피하고 싶다는 요구 때문에 (c)는 제외. (d)는 결정 31에서 이미 성능 병목의 원인이었던 Render 무료 티어 CPU 자원에 임베딩 추론 부하를 추가로 얹는 구조라 리스크가 큼. (e)는 브라우저(사용자 기기)에서 계산을 수행해 서버 비용·CPU 부담이 전혀 없고 외부 API 의존도 없음.
- **구현 방향**:
  - 검색용 업로드 이미지 임베딩: React 프론트엔드에서 `transformers.js`(CLIP)로 브라우저 안에서 직접 계산.
  - 카탈로그(상품 50개) 임베딩: 상품 등록/수정 시 로컬 스크립트로 오프라인 사전 계산 후 DB에 저장 — 프로덕션 요청 경로에서 계산하지 않아 운영 비용이 없음.
  - 서버(NestJS)는 두 벡터 간 코사인 유사도 계산만 수행 — 순수 연산이라 부담 없음.
- **첫 로드 지연 개선**:
  - 양자화 모델 사용 — CLIP full 모델(fp32, ~350MB) 대신 int8 양자화(`dtype: 'q8'`)로 다운로드 용량을 수분의 1로 축소.
  - 유휴 시간 프리페치 — `requestIdleCallback` 등으로 사용자가 실제 검색 버튼을 누르기 전, 페이지 유휴 시간에 모델을 미리 다운로드해 브라우저 Cache API에 캐싱(이후 브라우저당 재다운로드 없음).
- **트레이드오프**: 브라우저에서 모델을 처음 로드할 때 지연(양자화·프리페치로 완화), 오래된 브라우저의 WASM/WebGPU 미지원 가능성, 상용 호스팅 모델 대비 다소 낮을 수 있는 정확도.
- **재검토 트리거**: 상품 카탈로그가 수백~수천 개 규모로 커지거나 정확도 요구가 높아지는 시점 → 호스팅 임베딩 API(Voyage/Cohere)로 전환 검토. Render를 유료 티어로 전환하는 시점 → 서버사이드 자체 호스팅(CLIP)도 재검토 가능.
- **상태**: 설계 확정, 구현 전. Notion "기술 선택 근거 정리" 페이지에도 동일 내용 반영(2026-08-19).

### 33. 배송 추적(송장번호/택배사 + 배송 단계 타임라인) → 자체 이벤트 타임라인 (실제 택배사 API 미연동)

- **배경**: 관리자 대시보드의 주문 상태는 `SHIPPED`(배송 중) 하나로만 표현되어 있었고, 송장번호/택배사 정보 자체가 없어 "배송 중"이 실질적인 의미를 갖지 못함. "테스트로 배송까지의 흐름을 검증했다"는 근거를 남기고 싶다는 목표도 있었음.
- **비교한 대안**:
  - (a) 송장번호/택배사만 저장 + 택배사 홈페이지로 링크 위임 — 구현은 가장 가볍지만 "우리 앱 안에서 위치를 보여준다"는 경험이 없음.
  - (b) 실제 택배사 조회 API(스마트택배 등) 연동 — 검토했으나, 관리자가 입력하는 송장번호가 실제 택배사 시스템에 접수된 값이 아니라 테스트/가짜 데이터라서 연동해도 실제 위치 데이터를 얻을 수 없음. 이 프로젝트는 실제로 물건이 배송되는 이커머스가 아니므로 애초에 조회할 실체가 없다고 판단해 기각.
  - (c) 자체 배송 이벤트 타임라인 구현 — **선택**. 실제 물류 연동 없이도 "위치/진행 상태 추적"이라는 기능 자체를 직접 설계·구현·테스트할 수 있음.
- **선택 근거**: (c). 카테고리/색상처럼(결정 22) 종류가 적고 관리자가 직접 입력하는 값은 고정 enum으로 관리하는 이 프로젝트의 기존 기준과 일치하게, 택배사(`carrier`: CJ대한통운/한진택배/로젠택배/우체국택배/기타)와 배송 단계(`stage`: COLLECTED→IN_TRANSIT→OUT_FOR_DELIVERY→DELIVERED)를 모두 고정 enum으로 설계.
- **구현 세부사항**:
  - `orders`에 `tracking_number`(nullable, PAID까지만 끝난 주문엔 값 없음), `carrier` 컬럼 추가. 새 테이블 `delivery_events`(주문당 1:N, `stage`/`location`/`occurred_at`)로 단계별 기록을 남김.
  - `PATCH /admin/orders/:id/status`가 `PAID → SHIPPED` 전이 시 `trackingNumber`/`carrier`를 조건부 필수(`@ValidateIf`)로 검증.
  - **SHIPPED → DELIVERED 직접 전이를 상태 전이 API에서 제거**하고 `POST /admin/orders/:id/delivery-events`로만 진행되도록 함 — 두 경로가 공존하면 status와 배송 타임라인이 어긋날 수 있어(예: 중간 단계 없이 바로 DELIVERED로 점프), 상태값의 유일한 출처를 이벤트 타임라인으로 좁힘. 단계는 건너뛰거나 중복 기록할 수 없고(순서 위반 시 400), 마지막 단계(`DELIVERED`) 기록 시 주문 status도 함께 전이됨.
  - `GET /orders/lookup` 응답과 관리자 대시보드 모두에 송장정보/타임라인을 노출. SSE `order-update` 이벤트에도 함께 실어 실시간 반영.
- **테스트**: `test/app.e2e-spec.ts`에 실제 `AppModule`(진짜 DB)로 "주문 생성 → 재고 확인 → 결제 승인(Toss `fetch` mock, 결정 25/26과 동일 방식) → SHIPPED(송장 입력) → 배송 단계 순차 기록 → DELIVERED 자동 전이 → 주문 조회"까지 이어지는 풀 라이프사이클 테스트 1건 추가 — 상태 머신과 배송 타임라인이 끝까지 이어져 동작한다는 근거. 단계 순서 위반 시 거부되는 것도 함께 검증. 로컬 개발 DB로 실행해 통과 확인(2026-08-20).
- **트러블슈팅**: e2e 테스트 작성 중 `product_options.id`(BIGSERIAL) 컬럼을 `dataSource.query()`(raw SQL)의 `RETURNING id`로 읽으면 pg 드라이버가 문자열로 반환한다는 것을 발견 — TypeORM 리포지토리 경유 조회는 엔티티 메타데이터 기준으로 숫자로 변환되지만, raw query는 이 변환을 거치지 않음. 테스트 픽스처에서 `Number(...)`로 명시 변환해 해결.
- **재검토 트리거**: 실제 택배사 API 연동이 필요해지는 시점(진짜 물류 처리 도입 등) → `delivery_events`에 택배사 API 응답을 매핑하는 방식으로 전환 검토.

### 34. 관리자 대시보드 — 주문 상태별 서버사이드 페이지네이션/필터링 + 재고현황 카테고리 그룹화

- **배경**: "최근 주문" 목록이 최대 20건 고정 조회라 주문이 늘어나면 특정 상태(예: 지금 배송을 시작해야 할 PAID 주문)를 찾기 어렵고, "재고 현황"도 카테고리 구분 없이 한 테이블에 뒤섞여 있어 상품이 늘어날수록 파악이 어려움.
- **주문 목록**: 클라이언트 사이드 필터링(20건 고정 조회 유지) 대신 처음부터 서버사이드로 처리 — `GET /admin/orders/recent`에 `status`(선택)/`page`/`limit`(기본 1/20) 쿼리 파라미터를 추가하고, `GET /products`와 동일한 `{ items, total, page, totalPages }` 컨벤션으로 응답을 통일(결정 14의 페이지네이션 패턴 재사용). PENDING/PAID를 포함한 5개 상태 모두 탭으로 구분 — 관리자가 취해야 할 액션이 상태마다 다르므로(PENDING: 결제 확인/취소, PAID: 배송 시작) 일부 상태를 숨기면 오히려 예외처리가 늘어남.
- **SSE 갱신 방식 조정**: 페이지네이션/필터링이 생기면서 `order-update` 이벤트를 받을 때마다 로컬 배열에 직접 patch하던 기존 방식은 "지금 보고 있는 페이지/필터에 이 주문이 포함되는가"를 판단하기 까다로워짐. 이벤트 수신 시 현재 필터/페이지 기준으로 다시 조회(refetch)하는 방식으로 단순화(관리자 대시보드 규모에서는 재조회 비용이 무시할 만함).
- **재고현황**: `GET /admin/stock-overview` 응답을 `product.category` 기준으로 정렬해 반환(`categoryName` 필드 추가), 프론트엔드는 이미 정렬된 순서를 그대로 카테고리별 섹션으로 묶기만 하면 됨 — 카테고리 필터 드롭다운(한 번에 하나만 보임)은 전체 재고를 한눈에 파악하려는 목적(결정 14)과 어긋나 기각.
- **재검토 트리거**: 없음(서버사이드로 처리해 별도 트리거 없이 확장 가능).

### 35. 자체 회원가입/로그인 → 이메일+비밀번호, Redis 세션 + `X-Session-Token` 헤더

- **배경**: 여러 결정(3, 6, 15)이 "로그인 도입 시점"을 재검토 트리거로 남겨뒀고, CLAUDE.md 상단 원칙("User 모델은 향후 기업 소속 사용자 확장(B2B)을 고려해 설계")도 있어 기반이 되는 회원가입/로그인부터 구현.
- **세션 토큰 전달 방식 — 비교**: (a) httpOnly 쿠키 — 프론트(Cloudflare Pages)와 백엔드(Render)가 서로 다른 오리진이라 `SameSite=None; Secure` + CORS `credentials` 설정이 추가로 필요해 복잡도가 늘어남. 결정 7에서 "쿠키는 동의 절차·차단 설정으로 UX를 침해할 수 있어 선택하지 않는다"고 이미 정한 전례와도 같은 논리. (b) 커스텀 헤더(`X-Session-Token`) + localStorage(**선택**) — 기존 `X-Cart-Id`/`X-Admin-Token`과 동일한 패턴이라 일관성 있고, cross-origin 쿠키 설정 이슈 자체가 없음.
- **비밀번호 해싱 — 비교**: `bcrypt`(네이티브, 약간 빠름) vs `bcryptjs`(순수 JS, 네이티브 빌드 없음, **선택**) — 결정 27에서 로컬/Docker 환경 차이로 배포가 크래시난 사고 이후 이 프로젝트가 유지해온 "환경 차이 리스크 최소화" 기조와 같은 이유.
- **세션 저장소**: Redis(**선택**, 이미 인프라 있음) vs DB 테이블 — TTL(14일, 장바구니와 동일 기준·결정 3)이 기본 내장된 Redis가 세션 성격에 더 잘 맞음. 세션 키가 `session:{token}`으로 토큰 자체이지 사용자 ID가 아니라서, 같은 계정으로 여러 기기에서 로그인해도 기기마다 독립된 세션이 생기고(멀티 디바이스 로그인이 자연 지원), 로그아웃은 `redis.del`로 해당 세션만 즉시 무효화(JWT와 달리 블랙리스트 없이도 실제 무효화가 됨). 삭제는 멱등적으로 처리 — 이미 없는 토큰으로 로그아웃해도 에러 없음.
- **스키마**: `users`(id, email UNIQUE, password_hash, name). B2B 확장용 `company_id`는 지금 추가하지 않음(아직 B2B 단계 아님, 결정 4와 같은 기준) — 필요해지면 nullable FK로 추가.
- **가드**: `SessionGuard`(비동기로 Redis 조회 후 `request.user`에 채움) + `@CurrentUser()` 데코레이터로 보호 라우트에서 로그인 사용자 조회. `@SessionToken()` 데코레이터는 세션 조회 없이 헤더 값 자체가 필요한 로그아웃에서 사용.
- **테스트**: `auth.service.spec.ts`(회원가입 중복/비밀번호 해싱 검증, 로그인 실패, 세션 발급/조회/삭제) + `test/app.e2e-spec.ts`에 회원가입→중복 가입 거부→로그인→틀린 비밀번호 거부→`/me`→세션 없이 401→로그아웃→로그아웃 후 같은 토큰으로 `/me` 401까지 이어지는 풀 라이프사이클 e2e 테스트 추가. 로컬 개발 DB/Redis로 curl 스모크 테스트까지 실행해 통과 확인(2026-08-20).
- **이번 범위에서 제외(후속 이슈로 분리)**: 게스트 장바구니 → 로그인 사용자 장바구니 병합(결정 3의 재검토 트리거), 주문을 로그인 사용자 계정에 연결(현재 게스트 체크아웃 방식 유지), 관리자 SSE 사용자별 접근 제어(결정 15, 고객 로그인과는 별개 주제).
- **재검토 트리거**: B2B(Phase 2) 진입 시점 → `users`에 `company_id` nullable FK 추가 검토.

### 36. 게스트 장바구니 → 로그인 사용자 장바구니 병합 → 하이브리드(Redis + DB)

- **배경**: 로그인 기능(결정 35) 도입으로 결정 3에서 남겨둔 "로그인 도입 시점 → 하이브리드(Redis+DB 병합) 방식 전환 검토" 트리거가 발동. 로그인해도 장바구니가 여전히 `X-Cart-Id` 기준 Redis 그대로라 로그인 전/후 장바구니가 분리되어 있었음.
- **저장소 이원화 — 비교**: 로그인 사용자도 Redis 계속 사용(`cart:user:{userId}`로 키만 변경) vs DB 테이블(**선택**). 전자는 구현이 가볍지만 로그인 사용자 장바구니도 TTL로 만료되는 문제가 남아 "로그인했는데 왜 장바구니가 사라지냐"는 기대 위반이 생김. 로그인 사용자의 장바구니는 신원에 묶인 지속 데이터라 결정 3의 "휘발성 데이터엔 Redis" 기준을 거꾸로 적용해 DB(`cart_items`, `unique(user_id, product_option_id)`)로 영구 보관.
- **분기 방식**: 엔드포인트(`GET/POST/PATCH/DELETE /cart*`)는 그대로 두고, `CartService`가 `X-Session-Token` 유효 여부로 저장소만 분기. 세션이 없거나 무효해도 401을 던지지 않고 게스트로 취급(장바구니는 로그인 필수 기능이 아님). 응답 조립 로직(`buildResponse`)은 두 경로가 공유.
- **순환 의존성 회피**: `CartService`가 세션을 확인할 때 `AuthModule`을 import하지 않고, Redis를 직접 읽는 경량 유틸 `getSessionUserId`(`common/session/session.util.ts`)를 사용. 병합 호출을 위해 `AuthModule → CartModule` 단방향 의존성만 생기고, 반대 방향 의존성은 없음 — 두 모듈이 서로를 필요로 하는 것처럼 보였지만 실제로는 "세션 조회"(순수 함수로 대체 가능)와 "병합 실행"(진짜 서비스 의존)의 성격이 달라, 전자를 함수로 빼내는 것만으로 순환을 끊을 수 있었음.
- **병합 시점**: `POST /auth/register`/`POST /auth/login`에 `X-Cart-Id`가 함께 오면 세션 발급 직전에 `CartService.mergeGuestCartIntoUser(cartId, userId)` 호출 — 겹치는 상품은 수량을 더하고(신규 가입은 항상 빈 DB 카트라 사실상 이관), 병합 후 게스트 장바구니(Redis)는 삭제.
- **테스트**: `cart.service.spec.ts`(병합 시 빈 카트 no-op/신규 추가/기존 수량 합산/복수 상품 혼합, DB·Redis 분기) + `test/app.e2e-spec.ts`에 "게스트로 담기 → 회원가입 → DB 장바구니에 반영 + 게스트 장바구니 비워짐"과 "기존 DB 장바구니 + 새 게스트 장바구니 → 로그인 시 수량 합산"까지 실제 AppModule/DB/Redis로 검증.
- **이번 범위에서 제외**: 주문을 로그인 사용자 계정에 연결(현재 게스트 체크아웃 방식 유지, 결정 35에서도 같은 이유로 보류).
- **재검토 트리거**: 없음 (결정 3의 트리거가 이번에 해소됨).

### 37. 주문-계정 연결 + 마이페이지 (내 주문 목록/상세)

- **배경**: 로그인(결정 35)·장바구니 병합(결정 36)에 이어 로그인 기능의 마지막 반쪽짜리 조각 — 주문은 여전히 게스트 체크아웃(결정 6) 방식 그대로라 로그인 사용자가 "내 주문 목록"을 볼 방법이 없었음.
- **스키마**: `orders.user_id`(nullable FK). 게스트 체크아웃(결정 6)은 그대로 유지되므로 nullable — 로그인 사용자가 주문한 경우에만 채워짐. **트러블슈팅**: `number | null` 유니온 타입을 그대로 `@Column()`에 선언했더니 TypeScript 리플렉션이 `Object`로 찍어 TypeORM이 컬럼 타입을 추론하지 못해 마이그레이션이 즉시 실패 — 결정 27에서 겪었던 사고와 정확히 같은 원인. `type: 'int'`를 명시해 해결(이번엔 로컬에서 먼저 잡아 배포 전에 확인).
- **주문 생성**: `POST /orders`가 `X-Session-Token` 유효 여부를 장바구니 병합(결정 36)과 동일한 경량 유틸(`getSessionUserId`)로 확인해 `order.userId`에 기록. 체크아웃 폼(이메일/이름/전화번호/주소 직접 입력)은 그대로 둠 — `users`에 아직 전화번호/주소가 없어 자동완성 자체가 불가능해 이번 범위에서 제외.
- **API**: `GET /orders/my?page=&limit=`(목록, `GET /products`와 동일 페이지네이션 컨벤션), `GET /orders/my/:orderNumber`(상세) 모두 `SessionGuard` + `@CurrentUser()`로 보호. 상세 조회 시 `order.userId`가 현재 사용자와 다르면 404로 응답 — 403(권한 없음)이 아니라 404를 선택한 이유는 "이 주문번호가 존재하는데 내 게 아니다"라는 정보 자체도 노출하지 않기 위함(게스트 조회의 이메일 불일치 시 404와 같은 판단 기준, 결정 6).
- **모듈 의존성**: 새 엔드포인트가 `SessionGuard`/`@CurrentUser()`를 쓰기 위해 `OrdersModule`이 `AuthModule`을 import(단방향 — `AuthModule`은 `OrdersModule`을 모름). `AuthModule`이 `SessionGuard`를 export하도록 추가.
- **리팩터링**: 게스트 조회(`lookupOrder`)와 마이페이지 상세(`getMyOrderDetail`)가 품목+배송 타임라인 조립 로직(`buildOrderLookupResponse`)을 공유하도록 추출. 프론트엔드도 게스트 주문조회 결과와 마이페이지 상세가 `OrderDetailView` 공유 컴포넌트로 렌더링을 재사용.
- **비교한 대안(마이페이지 상세 UI)**: 목록에서 인라인 확장(토글) vs 별도 페이지 `/my/orders/:orderNumber`(**선택**) — 상세 정보(품목 여러 개 + 배송 타임라인)가 길어질 수 있어 별도 페이지가 더 깔끔하고, 공유 컴포넌트 재사용도 자연스러움.
- **테스트**: 유닛테스트(세션 유효 시 userId 기록/무효 시 null, 목록 페이지네이션, 상세 소유권 검증) + `test/app.e2e-spec.ts`에 "로그인 → 주문 생성 → 내 주문 목록/상세 확인 → 세션 없이 401 → 다른 사용자로는 목록에 안 보이고 상세는 404"까지 실제 AppModule/DB/Redis로 검증.
- **이번 범위에서 제외(후속 이슈로 분리)**: `users` 프로필에 전화번호/기본주소 저장 후 체크아웃 자동완성, 이 기능 이전에 생성된(`user_id` 없는) 레거시 주문을 사후에 계정과 연결하는 기능.
- **재검토 트리거**: 없음.

### 38. 관리자 인증 → 정적 공유 토큰에서 로그인 세션 + role 기반으로 전환 + SSE 단기 티켓 + 재고 토글/구매자 검색

- **배경**: 결정 16에서 배포 전 급하게 붙인 `X-Admin-Token`(정적 공유 시크릿, `.env`의 `ADMIN_TOKEN`과 단순 비교)은 로그인 시스템(결정 35)이 생기기 전 임시 방편이었음. 로그인 시스템이 생긴 지금 시점에, 관리자 대시보드 UX 개선(재고현황 토글, 구매자 검색) 요청과 함께 재검토함.
- **비교한 대안**:
  - (a) 그대로 유지하되 프론트엔드에서 로그인한 특정 계정(예: 고정 테스트 계정)일 때만 "관리자" 링크를 노출 — UI 노출만 바뀔 뿐 서버 인증은 여전히 정적 토큰이라 근본적 개선이 아니고, 무엇보다 특정 계정 이메일/비밀번호를 코드·마이그레이션에 하드코딩해야 해 자격증명이 공개 저장소에 남는 문제가 있음.
  - (b) `users.role` 컬럼(enum `user`/`admin`)을 추가해 로그인 세션 기반으로 완전히 전환.
- **선택 근거**: (b). 정적 토큰은 탈취되면 무기한 유효하고 회수(로테이션)가 번거로운 반면, role 기반은 로그인 시스템에 자연스럽게 편입되고 계정 단위로 권한을 회수할 수 있음. 자격증명을 코드에 남기지 않아도 되는 것도 장점 — 관리자 승격은 배포된 실제 계정에 대해 운영자가 직접 1회 수동 SQL을 실행하는 방식으로 처리(결정 22/26의 수동 백필과 동일한 패턴): `UPDATE users SET role = 'admin' WHERE email = '본인 이메일';`
- **구현 세부사항**:
  - `AdminGuard`가 `X-Session-Token`으로 세션을 조회한 뒤, role은 세션에 캐싱하지 않고 매 요청 DB(`users.role`)에서 직접 확인 — 권한 회수(강등)가 재로그인 없이 즉시 반영되도록 하기 위함. 관리자 API는 트래픽이 적어 요청마다 DB 조회 1회를 추가하는 비용은 무시 가능하다고 판단.
  - **SSE 인증 방식 변경**: `EventSource`는 커스텀 헤더를 보낼 수 없어 기존엔 세션 토큰을 아예 `?token=` 쿼리에 그대로 실었는데(결정 16의 트러블슈팅), 이는 URL에 장기 유효 토큰이 노출되는(브라우저 히스토리·서버 로그·Referrer 등에 남을 수 있는) 리스크가 있었음. `POST /admin/events/ticket`(`AdminGuard`로 보호)로 1회용 단기 티켓(TTL 30초, Redis)을 먼저 발급받아 `GET /admin/events?ticket=`으로 넘기고, 검증 즉시 소모(Redis `DEL`, 삭제된 키 개수로 재사용 여부 판별)하도록 `AdminSseGuard`를 별도로 둠. 네이티브 `EventSource` 자동 재연결은 이미 소모된 티켓을 재사용해 실패하므로, 프론트엔드에서 연결이 끊기면 직접 `close()` 후 새 티켓을 발급받아 재연결하도록 구현.
  - 컨트롤러 클래스 레벨의 `@UseGuards(AdminGuard)`를 제거하고, SSE(`events()`)를 제외한 모든 라우트에 개별적으로 `AdminGuard`를 걸음 — SSE만 `AdminSseGuard`를 쓰기 위함.
  - `GET /admin/orders/recent`에 `search` 쿼리 파라미터 추가 — `buyerName`/`buyerEmail` `ILIKE` OR 검색(TypeORM `where`에 배열을 넘기면 OR로 묶임).
  - 프론트엔드: `/admin` 라우트는 그대로 있지만 접근 게이팅을 `useAuth()`의 `role==='admin'` 여부로 처리(정적 토큰 재입력 화면 제거). 헤더의 "관리자" 링크도 admin 계정 로그인 시에만 노출. 재고 현황 카테고리 그룹은 `<details>/<summary>`로 토글 가능하게 변경.
  - `ADMIN_TOKEN` 환경변수와 관련 문서(`.env.example`, `.env.prod.example`, `ci.yml`, Swagger `addApiKey`)를 모두 제거.
- **테스트**: `AdminGuard`(세션 없음/무효/role≠admin/role=admin) + `AdminSseGuard`(ticket 없음/이미 소모됨/정상 소모)를 유닛테스트로 검증. e2e는 세션 없이 401, role='user' 계정으로 401(SSE 티켓 발급 포함), 발급받은 SSE 티켓이 실제로 1회만 사용 가능한지(재사용 시 401)까지 실제 AppModule+DB+Redis로 확인. 기존 배송 라이프사이클 e2e 테스트도 정적 토큰 대신 role 승격 후 로그인한 세션 토큰을 쓰도록 재작성.
- **재검토 트리거**: 관리자가 여러 명으로 늘어나 세분화된 권한(예: 상품 등록만 가능/주문 처리만 가능)이 필요해지면 → role을 단일 enum이 아닌 permission 목록 방식으로 확장 검토.

### 39. 재고 현황 화면 → 토글(`<details>`)에서 최근 주문과 동일한 탭 필터로 재변경

- **배경**: 결정 38에서 카테고리별 토글(`<details>/<summary>`)로 구현한 직후, 최근 주문 섹션의 상태 탭(전체/결제대기/...)과 화면 패턴이 다르다는 피드백으로 재검토.
- **비교한 대안**: (a) 토글 유지, (b) 최근 주문과 동일한 탭 필터(전체/신발/상의/하의)로 교체 — 선택한 탭의 카테고리 재고만 표로 보여줌.
- **선택 근거**: (b). 같은 화면(관리자 대시보드) 안에서 "목록을 좁혀 본다"는 동일한 조작을 서로 다른 UI 패턴(토글 vs 탭)으로 표현할 이유가 없다고 판단 — 최근 주문에서 이미 검증된 탭 패턴을 재사용해 일관성을 높임. 결정 34가 "카테고리 필터는 전체를 한눈에 보려는 목적과 어긋나 기각"했던 판단은, 최근 주문 탭 UI가 이미 대시보드에 존재하는 지금 시점엔 "한 화면 안에서 서로 다른 두 상호작용 패턴이 공존하는 것"이 오히려 더 큰 일관성 비용이라고 재평가함.
- **구현**: 탭 목록은 하드코딩하지 않고 재고 데이터의 `categoryName`에서 동적으로 추출 — 카테고리가 늘어나도 코드 변경 없이 반영됨.
- **재검토 트리거**: 없음.

### 40. 보안 점검 후속 조치 — trust proxy, helmet, 로그인 rate limit, 업로드 확장자, 헤더 파싱

- **배경**: 클린코드/보안 관점으로 코드베이스(특히 막 만든 관리자 RBAC 인증 로직)를 점검한 결과 5건의 개선 포인트가 발견됨. 인젝션/인증우회/RCE급 치명적 이슈는 없었고, 대부분 기존 방어를 더 단단하게 다지는 defense-in-depth 성격.
- **1. `trust proxy` 미설정**: Render는 리버스 프록시 뒤에서 앱을 구동하는데 `app.set('trust proxy', ...)`가 없어 Express의 `req.ip`가 항상 프록시 IP로 고정됨. `ThrottlerGuard`(결정 30)는 이 IP를 키로 100회/60초 제한을 걸고 있어, 이 설정이 없으면 전체 사용자가 하나의 rate limit 버킷을 공유하는 것과 같아짐(트래픽이 몰리면 무관한 사용자끼리 서로의 요청 때문에 429를 받을 수 있음). `main.ts`에 `app.set('trust proxy', 1)` 추가로 해결(Render는 프록시 1홉).
- **2. `helmet` 미적용**: 기본 보안 헤더(X-Content-Type-Options 등)가 전혀 없었음. 세션 토큰을 `localStorage`에 저장하는 구조(결정 35, cross-origin 제약으로 의도적 선택)라 XSS 발생 시 피해 반경이 큰 편인데, 지금은 XSS 싱크(`dangerouslySetInnerHTML`/`eval` 등)가 없어 당장 위험하진 않지만 저비용 방어선을 추가로 둠. `app.use(helmet())` 적용.
- **3. `/auth/login`·`/auth/register`에 별도 rate limit 없음**: 전역 기본값(100회/60초, 결정 30)만 적용돼 브루트포스 저항이 느슨함. 두 라우트에만 `@Throttle({ default: { limit: 10, ttl: 60_000 } })`을 개별 적용.
- **4. 관리자 이미지 업로드의 저장 경로 확장자를 사용자 파일명에서 그대로 가져옴**: `file.mimetype`(MIME 화이트리스트로 검증됨)과 달리 `extension = file.originalname.split('.').pop()`은 검증이 전혀 없어, 파일명에 임의 문자열(예: `evil.php`)을 넣으면 그대로 저장 경로에 반영됨. `AdminGuard`로 관리자 계정만 접근 가능하고 Supabase Storage가 업로드 시 지정한 `contentType`을 그대로 서빙해 당장 XSS/RCE로 이어지진 않지만(브라우저는 확장자가 아니라 응답 Content-Type을 기준으로 렌더링 여부를 판단), 확장자를 검증된 MIME 타입에서 매핑하는 고정 테이블로 교체해 근본 원인을 제거.
- **5. `AdminGuard`/`AdminSseGuard`가 헤더·쿼리 배열 케이스를 무시**: `request.headers['x-session-token']`/`request.query['ticket']`을 `as string`으로 단언만 하고 실제 `string[]`(같은 헤더/쿼리가 중복 전달된 경우 Node/Express가 반환)일 가능성을 걸러내지 않음. 배열이 템플릿 리터럴에서 문자열로 뭉개져 조회가 실패해 결과적으로 401로 안전하게 막히긴 했지만(익스플로잇 가능한 상태는 아니었음), `SessionGuard`는 이미 `Array.isArray` 체크를 하고 있어 일관성이 없었음. `typeof === 'string'` 체크로 통일.
- **부가 점검**: `tsc --noUnusedLocals --noUnusedParameters`, `ts-prune`, `depcheck`으로 backend/frontend 전체의 미사용 코드·의존성을 훑었으나 실질적인 dead code는 발견되지 않음 — `depcheck`이 backend에서 flag한 `@nestjs/schematics`/`@types/multer` 등은 `nest-cli.json`이나 앰비언트 타입(`Express.Multer.File`)으로 실제 쓰이고 있는 false positive로 확인해 제거하지 않음.
- **테스트**: `AdminGuard`/`AdminSseGuard`에 배열 헤더·쿼리 거부 케이스, `SupabaseStorageService`에 확장자가 파일명이 아닌 MIME 타입에서 결정되는지 검증하는 유닛테스트 추가.
- **재검토 트리거**: 없음.

### 41. 보안 점검 후속 조치 2차 — 로그 PII 마스킹, 로그인 타이밍 균일화, 목록 조회 페이지네이션 상한

- **배경**: 결정 40 이후 `main` 브랜치 backend 전체를 보안 관점으로 재점검(도메인별 병렬 리뷰 → 중요 이상은 실제 코드에서 직접 재검증). 치명적 이슈는 없었고, DB TLS 인증서 검증(`rejectUnauthorized: false`)은 Supabase CA/Render env 설정이 필요해 별도로 분리, 순수 코드 수정으로 끝나는 3건만 이슈 #78로 묶어 처리.
- **1. 로그 PII/티켓 평문 기록**: `LoggingInterceptor`가 `originalUrl`을 쿼리스트링째 기록해 `GET /orders/lookup?email=`의 구매자 이메일(PII)과 `GET /admin/events?ticket=`의 SSE 단기 티켓이 로그에 평문으로 남았음. 경로만 기록(`originalUrl.split('?')[0]`)하도록 변경 — "URL에 크리덴셜을 싣지 않으려던" 티켓 설계(결정 38) 취지를 로그 단에서도 관철. (전체 쿼리 제거 방식을 택한 이유: 파라미터별 마스킹은 새 민감 파라미터가 추가될 때 누락 위험이 있어, 경로만 남기는 편이 더 견고)
- **2. 로그인 타이밍 계정 열거**: `AuthService.login()`이 미존재 이메일을 `bcrypt.compare` 없이 즉시 반환해, 존재(느린 bcrypt)/미존재(즉시) 간 응답시간 차이로 가입 여부가 열거되는 타이밍 사이드채널(OWASP A07). 미존재 시에도 고정 더미 해시(`DUMMY_PASSWORD_HASH`)에 `compare`를 1회 수행해 경로별 소요시간을 균일화. (단, 회원가입의 `EMAIL_ALREADY_EXISTS`가 존재를 직접 노출하는 벡터는 남아 있음 — rate limit(결정 40)과 함께 봐야 실효가 있는 defense-in-depth 성격)
- **3. 목록 조회 페이지네이션 상한 부재**: `/products`(무인증)·`/orders/my`·`/admin/orders/recent`의 `page`/`limit`이 `parseInt`만 거쳐 상한·NaN 검증이 없어 `?limit=1000000`(대량 로드)·`?limit=abc`(`NaN`이 `take`/`skip`으로 전파)로 자원 고갈을 유발할 수 있었음(A05, Render 0.1 vCPU 환경·결정 31). 공용 `PaginationQueryDto`(`@Type(()=>Number)`+`@IsInt()`+`@Min(1)`+`@Max(100)`)를 도입하고 세 엔드포인트에 적용. **page/limit을 선택으로 두어** 생략 시 각 서비스의 기존 기본값(products 12, my 10, admin 20)이 그대로 적용됨 — 프론트 호출값(12/10/20)은 상한 안쪽이라 동작 변화 없음. `/admin/orders/recent`의 `status`도 이 참에 `@IsEnum`으로 검증 추가.
- **테스트**: `PaginationQueryDto`(상한/정수/NaN/경계값) + `auth.service.spec`(미존재 계정도 `bcrypt.compare` 호출 검증) 유닛테스트 추가. 기존 유닛 102개·e2e 9개 전부 통과 확인.
- **분리 처리(후속)**: DB TLS 인증서 검증 활성화(`rejectUnauthorized: true` + Supabase CA를 `DB_CA_CERT` env로 주입) — Pooler 인증서 호환성 검증이 필요해 사용자 설정 작업과 함께 별도 진행.
- **재검토 트리거**: 없음(TLS 건은 후속 작업으로 이관).

### 42. 관리자 대시보드 개편 — 좌측 사이드바 + 통계 시각화 + 재고 전용 화면 + 재고부족 알림 + 회원·구매자 관리 (3단계 분할)

- **배경**: 관리자 화면이 상단 탭 2개(대시보드/상품 등록)에 대시보드 한 화면에 재고 현황 + 최근 주문이 섞여 있었음. 매출/판매량 시각화, 재고 전용 관리, 재고 부족 알림, 회원/구매자 관리까지 확장 요구가 생겨 최상위 네비게이션 축부터 개편.
- **확정된 설계 결정(사용자 선택)**:
  - **차트 라이브러리 → Recharts**: (비교) Chart.js(react-chartjs-2, 의존성 2개)·의존성 없이 SVG 직접 구현. React 선언적 API·반응형·보편성에 더해 의존성 1개로 최소화되어 채택. SVG 직접 구현은 툴팁 등 인터랙션·유지보수 부담이 커 기각.
  - **시각화 지표**: 매출 추이(시계열)/판매량(수량)/카테고리별 비중/인기 상품 Top N/주문 상태 분포. 매출은 **PAID·SHIPPED·DELIVERED만 집계**(PENDING·CANCELLED 제외).
  - **화면 구조 → 좌측 사이드바**: (비교) 5개 상단 탭 유지. 탭이 5개 이상으로 늘어 상단 탭은 가로 공간·가독성 한계가 있어 사이드바로 최상위 네비게이션 개편(결정 39가 재고현황을 탭으로 바꾼 것은 한 화면 내부의 목록 필터 축이라 별개).
  - **회원·구매자 관리 → 읽기 전용 조회+검색**: 회원(로그인 `users`)과 구매자(게스트 포함 `orders.buyerEmail` 기준) 둘 다 이름/이메일 검색 제공. 역할 변경·주문내역 연결은 이번 범위 밖(관리자 승격은 계속 수동 SQL, 결정 38).
  - **재고 부족 기준 → 고정 임계값(재고 ≤ 5, 0은 품절)**: 프론트 상수(`LOW_STOCK_THRESHOLD`)로 두어 추후 조정 가능. 상품별/카테고리별 세분화가 필요해지면 백엔드 설정값으로 이전 검토.
- **3단계 분할(각 단계 = PR)**:
  - **1단계(이슈 #80)**: 좌측 사이드바 개편 + 재고 관리 화면 분리 + 재고 부족 알림 배너. 기존 대시보드를 `AdminInventoryPage`(재고)·`AdminOrdersPage`(주문)로 분리하고, **SSE 단일 연결과 재고 상태를 shell(`AdminPage`)로 상향**해 배너(전 화면 상단)와 재고 화면이 공유(order-update는 nonce로 주문 화면에 전파). 대시보드(통계)·회원·구매자는 플레이스홀더. 프론트 전용 변경(새 API 불필요 — 기존 `stock-overview`로 충분).
  - **2단계**: 통계 대시보드 — 백엔드 집계 API + Recharts 5개 지표.
  - **3단계**: 회원·구매자 관리 — 읽기 전용 목록/검색(백엔드 조회 API 추가).
- **재검토 트리거**: 관리자 권한이 세분화되거나(결정 38) 재고 임계값을 상품별로 두어야 하면 → 임계값 백엔드 이전 검토.

### 43. 상품 관리 확장 — 소프트 삭제 + 재입고/옵션 추가 + 재고 상태 필터

- **배경**: 대시보드 개편(결정 42) 후속. 재고 부족/품절이 "어떤 상품인지" 필터로 안 보이고, 상품 등록만 있고 삭제·기존 상품 수정(재입고/옵션 추가)·상품 목록 화면이 없었음(이슈 #88).
- **삭제 → 소프트 삭제(`products.is_active`)**: (비교) 하드 삭제하되 주문 미연결 상품만 삭제 허용. 상품/옵션은 `order_items` FK로 주문 이력에 연결돼 하드 삭제 시 이력이 깨지고, "판매된 적 있는 상품은 영영 못 지움" 문제도 생김. `is_active=false`로 숨기면 이력 보존 + 언제든 삭제 가능. 마이그레이션(`AddProductIsActive`, 멱등적)으로 컬럼 추가.
- **소프트 삭제 파급**: 비활성 상품을 `GET /products`·`/products/:id`·이미지 검색·관리자 `stock-overview`에서 제외(`where isActive:true`). 통계(`getStats`)는 과거 주문 기반이라 비활성 상품의 과거 매출을 그대로 유지. **주의**: `GET /products/:id`는 `CacheInterceptor`(TTL 30초, 결정 30) 대상이라 소프트 삭제가 최대 30초 지연 반영됨(허용).
- **수정 → 재입고 + 옵션 추가**: 재입고는 `PATCH /admin/products/:productId/options/:optionId`(절대값 덮어쓰기), 옵션 추가는 `POST /admin/products/:id/options`(SKU 중복 409). 둘 다 SSE `stock-update` 발행해 재고 화면 실시간 반영 — 신규 옵션은 재고 목록에 없던 항목이라 그룹핑용으로 `StockUpdateEvent`에 `categoryName`(옵션) 필드 추가. 관리자 상품 목록은 `GET /admin/products`(활성만, 옵션·총재고 포함, 이름 검색·페이지네이션).
- **재고 상태 필터**: 재고 화면에 탭(전체 / 재고 부족(≤5, 품절 포함) / 품절(0)) 추가, 카테고리 필터와 병행. 재고 부족 배너 클릭 시 재고 화면으로 이동하며 '재고 부족' 필터 자동 적용(shell→화면 nonce 신호). 전부 클라이언트 계산.
- **프론트**: 사이드바 '상품 등록' → '상품 관리'(`AdminProductsPage`) — 상품 목록 + 소프트 삭제(확인) + 옵션별 재입고 인라인 + 옵션 추가 + 기존 신규 등록 폼(등록 후 목록 갱신).
- **재검토 트리거**: 비활성 상품 복구(재활성화)·완전 삭제가 필요해지면 → 관리 화면에 복구/영구삭제 추가 검토.
- **2026-08-24 UX 조정(이슈 #90)**: 재입고를 '상품 관리'에서 '재고 관리'로 이동(재고를 확인하는 화면에서 바로 처리 — 역할 분리: 재고관리=조회+재입고, 상품관리=등록/삭제/옵션). 재고 화면 재입고를 위해 `stock-overview`/`StockUpdateEvent`에 `productId` 추가. 상품 관리 신규 등록 폼은 목록 아래 스크롤 대신 서브탭(목록/신규 등록)으로 분리(회원·구매자 화면과 동일 패턴). 후속(이슈 #90에 이어 별도 처리).
- **2026-08-24 후속 완료(이슈 #92)**: ①이미지 업로드에 `cacheControl='31536000'`(1년) 지정 — URL이 불변(타임스탬프+uuid)이라 장기 캐시 안전, 브라우저 재다운로드/트래픽 감소. ②**SKU 유니크 대안 B** — 전역 `UNIQUE(sku)`를 활성 옵션에만 적용하는 부분 유니크 인덱스(`CREATE UNIQUE INDEX ... ON product_options(sku) WHERE is_active`)로 전환해 소프트 삭제된 상품의 SKU 재사용 허용. 부분 인덱스가 `product_options` 컬럼만 참조 가능해 `product_options.is_active` 추가, `softDeleteProduct`가 상품+옵션을 함께 비활성화(트랜잭션), SKU 중복 검사도 활성 옵션만 대상으로 변경.

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
22. ~~성능 병목 진단(P2-1) — 증거 기반 가설 검증(DB 풀/쿼리시간 반증 → 라우트별 비교 → 쿼리 분리로 해결, +60% 처리량/-38% p95)~~ ✅ — 2026-08-18
23. 남은 작업: 정식 k6 처리량 스크립트(`k6/throughput-test.js`)에 thresholds(p95<300ms, error_rate<1%) 명시해 pass/fail 자동 판정되도록 정리
24. ~~배송 추적(송장번호/택배사 + 배송 단계 타임라인) 구현 + 주문~배송완료 풀 라이프사이클 e2e 테스트 (결정 33)~~ ✅ — 2026-08-20, 이슈 #59
25. ~~관리자 대시보드 주문 상태별 서버사이드 페이지네이션/필터링 + 재고현황 카테고리 그룹화 (결정 34)~~ ✅ — 2026-08-20, 이슈 #61
26. ~~자체 회원가입/로그인 (이메일+비밀번호, Redis 세션) 구현 + 풀 라이프사이클 e2e 테스트 (결정 35)~~ ✅ — 2026-08-20, 이슈 #63
27. ~~게스트 장바구니 → 로그인 사용자 장바구니 병합 (하이브리드 Redis+DB, 결정 36)~~ ✅ — 2026-08-20, 이슈 #65
28. ~~주문-계정 연결 + 마이페이지 (내 주문 목록/상세, 결정 37)~~ ✅ — 2026-08-20, 이슈 #67
29. ~~관리자 인증을 정적 토큰에서 로그인 세션 + role 기반으로 전환 + SSE 단기 티켓 + 재고현황 토글/구매자 검색 (결정 38)~~ ✅ — 2026-08-20, 이슈 #69
30. ~~보안 점검 후속 조치 2차 — 로그 PII 마스킹/로그인 타이밍 균일화/목록 페이지네이션 상한 (결정 41)~~ ✅ — 2026-08-24, 이슈 #78
31. 후속(사용자 설정 필요) — DB TLS 인증서 검증 활성화(`rejectUnauthorized: true` + Supabase CA를 `DB_CA_CERT`로 주입, Pooler 호환성 배포 검증)
32. ~~관리자 대시보드 개편 1단계 — 좌측 사이드바 + 재고 관리 화면 분리 + 재고 부족 알림 (결정 42)~~ ✅ — 2026-08-24, 이슈 #80
33. ~~관리자 대시보드 개편 2단계 — 통계 대시보드(GET /admin/stats 집계 API + Recharts: KPI/매출추이 일·월 토글/카테고리 도넛/인기상품 Top5/주문상태 분포, 결정 42)~~ ✅ — 2026-08-24, 이슈 #84
34. ~~관리자 대시보드 개편 3단계 — 회원·구매자 읽기 전용 목록/검색(GET /admin/members·/admin/buyers, 결정 42)~~ ✅ — 2026-08-24, 이슈 #86 → **대시보드 개편(결정 42) 3단계 전부 완료**
   - (개편 중 나온 UX 후속: 재고 페이지네이션+화면 폭 — 이슈 #82/#83 완료)
35. ~~상품 관리 확장 — 재고 상태 필터 + 소프트 삭제/재입고/옵션 추가 (결정 43)~~ ✅ — 2026-08-24, 이슈 #88
36. 다음 기능 검토 중 — Double-entry Ledger, 멀티 PG Orchestration (PortOne 추가)
