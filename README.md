# Commerce Core

프로덕션 품질을 지향하는 이커머스 포트폴리오 프로젝트입니다. 기술 면접에서 방어 가능한 수준의 아키텍처를 목표로, 기능 구현 전 항상 여러 대안을 비교하고 근거를 남기며 개발합니다.

## 핵심 구성요소

- Payment Orchestration Layer
- 자체 Double-entry Ledger
- 멀티 PG 연동 (TossPayments + PortOne)
- 정산 배치 (Reconciliation)

개발 순서는 B2C를 먼저 구축하고, B2B(승인 워크플로우·계약 단가·여신/인보이스)는 Phase 2에서 다룹니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Backend | NestJS + PostgreSQL |
| Cache / 세션 | Redis |
| 메시징 | Kafka (결제 파이프라인 전용) |
| Frontend | React (Vite) |
| 부하테스트 | k6 |

## 폴더 구조

```
CommerceCore/
  CLAUDE.md          # 설계 결정 로그 및 진행 상황 (지속적 컨텍스트)
  Docker-compose.yml  # PostgreSQL / Redis / Kafka 로컬 환경
  backend/            # NestJS
  frontend/           # React (Vite)
```

## 로컬 개발 환경

### 1. 인프라 (Docker Compose)

```bash
docker-compose -f Docker-compose.yml up -d
```

- PostgreSQL: `localhost:5433` (로컬 PostgreSQL과의 포트 충돌 회피)
- Redis: `localhost:6379`
- Kafka: `localhost:9092` (KRaft 모드, `apache/kafka:3.7.0`)

### 2. 백엔드

```bash
cd backend
npm install
npm run start:dev   # http://localhost:3001
```

`.env` 예시:

```
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=commerce
DB_PASSWORD=commerce_local_pw
DB_DATABASE=commerce_core
PORT=3001
```

### 3. 프론트엔드

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (사용 중이면 자동으로 다음 포트)
```

## API 개요

모든 장바구니/주문 요청에는 `X-Cart-Id` 헤더가 필요합니다. 에러 응답은 `{ statusCode, message }` 포맷입니다.

| Method | Path | 설명 |
|---|---|---|
| GET | `/products?category=` | 카테고리별 상품 목록 조회 |
| GET | `/products/:id` | 상품 상세 + 옵션(사이즈/색상별 재고) 조회 |
| GET | `/cart` | 현재 장바구니 조회 |
| POST | `/cart/items` | 장바구니에 상품 추가 |
| PATCH | `/cart/items/:productOptionId` | 수량 변경 |
| DELETE | `/cart/items/:productOptionId` | 장바구니 항목 제거 |
| POST | `/orders/validate-stock` | 주문 전 재고 확인 (항상 200) |
| POST | `/orders` | 주문 생성 (비관적 락 기반 재검증) |
| GET | `/orders/lookup?orderNumber=&email=` | 주문번호+이메일 조합 조회 |

전체 스키마는 `commerce-core-schema.sql` 참고.

## 설계 원칙

- Ledger는 결제수단에 독립적으로 설계 (특정 PG에 종속되지 않도록)
- User 모델은 향후 기업 소속 사용자 확장을 고려해 설계
- 구현은 계층별이 아닌 **기능별 수직 슬라이스** 순서로 진행: 상품 조회 → 장바구니 → 재고 확인 → 주문 생성 → 주문 조회

모든 설계 결정(대안 비교, 선택 근거, 재검토 트리거)은 [`CLAUDE.md`](./CLAUDE.md)에 기록되어 있습니다.

## 진행 상황

- [x] 상품 조회 API (`GET /products`, `GET /products/:id`)
- [x] 프론트엔드 프로젝트 스캐폴딩
- [ ] 프론트엔드 상품 목록/상세 화면 연결
- [ ] 장바구니 (Redis)
- [ ] 재고 확인 / 주문 생성 (비관적 락)
- [ ] 주문 조회
- [ ] k6 부하테스트 (동시성 검증)

개발 과정은 Tistory 블로그 시리즈 "이커머스 핵심기능"에 기록하고 있습니다.
