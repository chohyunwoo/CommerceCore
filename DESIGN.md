# Commerce Core Design System

<!-- design-md:section experience -->
## 1. Experience

<!-- design-md:claim scope kind=product-surface lang=en -->
### Scope

Commerce Core는 프로덕션 품질을 지향하는 이커머스 포트폴리오로, 신발·상의·하의 패션 카탈로그를 파는 B2C 스토어프론트와 재고·주문·배송·통계를 다루는 관리자 대시보드로 구성된다.
<!-- design-md:claim-end -->

<!-- design-md:claim primary-tasks kind=user-outcomes count=4 lang=en -->
### Primary tasks

- 상품을 카테고리·검색·이미지 유사도로 탐색하고 상세 옵션(사이즈·색상)과 재고를 확인한다

- 장바구니에 담아 재고를 확인한 뒤 게스트 또는 로그인 상태로 주문·결제한다

- 주문번호와 이메일로 주문을 조회하거나 마이페이지에서 배송 타임라인을 추적한다

- 관리자는 재고·주문·배송을 관리하고 매출·판매 통계를 확인한다
<!-- design-md:claim-end -->

### Design direction

- 무채색 모노크롬: 잉크(#1e1e1e)와 캔버스(흰색)를 주 색으로 삼아 상품 이미지가 유일한 채도가 되게 한다

- 스토어프론트는 0px 라운드의 에디토리얼 플랫 미학, 관리자 대시보드는 4–10px 소프트 라운드로 도구적 밀도를 확보한다

- 대문자 마이크로 라벨(11–12px, 자간 0.08–0.15em)로 카테고리·폼 라벨·상태를 표기한다

- 그림자는 거의 쓰지 않고 1px 헤어라인 경계로 깊이를 표현한다

### Principles

- 상품이 주인공이다: UI는 상품 사진을 담는 프레임이며 장식을 최소화한다

- 절제가 곧 고급감이다: 본문 400과 강조 600–700 두 축의 굵기와 좁은 색 팔레트를 유지한다

- 한국어 우선: 본문은 Noto Sans KR로 읽히고 라틴 라벨은 대문자로 표기한다

### Avoid

- 브랜드 컬러 액센트나 그라데이션으로 상품 이미지와 경쟁하지 않는다

- 스토어프론트 인터랙티브 요소에 라운드를 넣지 않는다(관리자 대시보드는 예외)

- 긴급성을 유도하는 배지나 과장된 문구를 쓰지 않는다

<!-- design-md:section foundations -->
## 2. Foundations

<!-- design-md:claim foundations kind=rules-or-constraints lang=en -->
### Semantic tokens

- **color.alert-bg**: `#fdf6e3` — 재고 부족 배너 배경
- **color.alert-border**: `#f0c36d` — 재고 부족 배너 경계
- **color.alert-fg**: `#7a5b00` — 재고 부족 배너 텍스트
- **color.canvas**: `#ffffff` — 페이지 캔버스
- **color.danger**: `#dc2626` — 관리자 위험 액션(취소 등)
- **color.error**: `#c0392b` — 폼/재고 오류 텍스트
- **color.hairline**: `#dfdfdf` — 1px 헤어라인 경계선
- **color.image-surface**: `#f0f0f0` — 상품 이미지 로드 전 배경
- **color.ink**: `#1e1e1e` — 본문·아이콘·경계 등 주 색(잉크)
- **color.live**: `#22c55e` — SSE 실시간 연결 표시 점
- **color.low-stock**: `#b7791f` — 재고 부족 강조
- **color.muted**: `#757575` — 보조/설명 텍스트
- **color.on-ink**: `#ffffff` — 잉크 배경 위 텍스트
- **color.role-admin**: `#2a78d6` — 관리자 role 배지
- **color.status.cancelled.bg**: `#fee2e2`
- **color.status.cancelled.fg**: `#991b1b`
- **color.status.delivered.bg**: `#d1fae5`
- **color.status.delivered.fg**: `#065f46`
- **color.status.paid.bg**: `#dbeafe`
- **color.status.paid.fg**: `#1e40af`
- **color.status.pending.bg**: `#fef3c7`
- **color.status.pending.fg**: `#92400e`
- **color.status.shipped.bg**: `#ede9fe`
- **color.status.shipped.fg**: `#5b21b6`
- **font.sans**: `'Helvetica Neue', 'Noto Sans KR', Arial, sans-serif` — 한국어는 Noto Sans KR
- **motion.base**: `0.2s`
- **motion.fast**: `0.15s`
- **motion.image**: `0.5s` — 상품 이미지 확대 전이
- **radius.badge**: `2px` — 주문 상태 배지
- **radius.banner**: `8px` — 재고 부족 배너
- **radius.card**: `10px` — 관리자 통계 카드/KPI 타일
- **radius.control**: `6px` — 관리자 네비/토글
- **radius.input**: `4px` — 관리자 입력/검색
- **radius.none**: `0` — 스토어프론트 버튼·입력·카드(에디토리얼 플랫)
- **shadow.menu**: `0 10px 16px rgba(0, 0, 0, 0.05)` — 모바일 헤더 드롭다운 한정
- **shadow.none**: `none` — 기본은 그림자 없음(헤어라인으로 깊이)
- **space.lg**: `24px`
- **space.md**: `16px`
- **space.section**: `72px`
- **space.sm**: `8px`
- **space.xl**: `40px`
- **space.xs**: `4px`
- **text.base-line**: `1.6` — 본문 기본 행간
- **text.base-size**: `13px` — 본문 기본 크기
- **tracking.label**: `0.1em` — 대문자 마이크로 라벨 자간(0.08–0.15em 범위 대표값)
- **tracking.tight**: `-0.01em` — 제목 자간
- **weight.bold**: `700` — 배지 등 강조
- **weight.medium**: `500` — 로고 등
- **weight.regular**: `400` — 본문 기본 굵기
- **weight.semibold**: `600` — 관리자 강조

### Contrast pairs

- color.ink on color.canvas: minimum 4.5:1
- color.on-ink on color.ink: minimum 4.5:1
- color.muted on color.canvas: minimum 4.5:1

### Reduced motion

Required.

### Foundation rules

- 색 팔레트는 무채색 잉크/캔버스/헤어라인이 기본이며, 유채색은 주문 상태 배지와 관리자 알림 등 의미 전달에만 제한적으로 쓴다

- 라운드는 스토어프론트 0px, 관리자 대시보드 4–10px로 화면 성격에 따라 분리한다

- 깊이는 그림자 대신 1px 헤어라인 경계로 표현한다(모바일 헤더 드롭다운만 예외적으로 옅은 그림자 사용)

- 대문자 라틴 라벨에는 0.08–0.15em 자간을 준다
<!-- design-md:claim-end -->

<!-- design-md:section typography-assets -->
## 3. Typography & Assets

### Type roles

| Role | Usage | Family | Size | Weight | Line height | Tracking |
|---|---|---|---|---|---|---|
| body | 본문·표·기본 텍스트 | 'Helvetica Neue', 'Noto Sans KR', Arial, sans-serif | 13px | 400 | 1.6 |  |
| micro-label | 대문자 카테고리·폼 라벨·상태 |  | 11–12px | 400 |  | 0.08–0.15em |
| product-title | 상품 상세 제목 |  | 26px | 400 |  | -0.01em |
| page-title | 폼/페이지 제목 |  | 24px | 400 |  | -0.01em |
| section-heading | 관리자 섹션 제목 |  | 22px | 400 |  |  |
| kpi-value | 관리자 KPI 수치 |  | 26px | 600 |  |  |

### Assets

| Asset | Kind | Source status | License status | Source | Notes |
|---|---|---|---|---|---|
| noto-sans-kr | font | official | verified | Google Fonts (SIL Open Font License 1.1) | 한국어 본문 |
| helvetica-neue | font | user-provided | not-required | 시스템 폰트 폴백 | 라틴 폴백; 없으면 Arial/sans-serif |

### Rules

- 굵기는 본문 400과 강조 600–700 두 축을 유지한다

- 라틴 라벨은 대문자로 표기하고 자간을 넓힌다

<!-- design-md:section components-states -->
## 4. Components & States

### Component: button

**Semantics:** 주요 행동 버튼. 아웃라인 기본형은 1px 잉크 테두리이며 호버 시 잉크 배경으로 반전되고, filled는 잉크 배경에 흰 대문자 레이블이다. 라운드는 0px.

- Anatomy: 레이블
- Variants: outline(기본), filled, small
- States: default, hover, focus-visible, disabled
- Token references: color.ink, color.on-ink, tracking.label, radius.none, motion.base

- Interaction kind: interactive

#### State applicability

| State | Applicability | Reason |
|---|---|---|
| default | applicable |  |
| hover | applicable |  |
| focus-visible | applicable |  |
| disabled | applicable |  |
| loading | not-applicable | 제출 버튼은 별도 로딩 스피너 없이 비활성으로 처리한다 |
| error | not-applicable | 버튼 자체는 오류 상태를 갖지 않고 폼 필드가 오류를 표시한다 |
| success | not-applicable | 성공은 상위 화면 메시지(예: 장바구니 담김)로 표현한다 |

### Component: option-chip

**Semantics:** 상품 상세의 사이즈·색상 선택 칩. 선택(selected) 시 잉크 배경으로 반전되고, 품절 옵션은 disabled + 취소선으로 표시한다.

- Anatomy: 옵션 값 레이블
- Variants: selected(잉크 반전)
- States: default, hover, focus-visible, disabled
- Token references: color.ink, color.hairline, color.on-ink, radius.none

- Interaction kind: interactive

#### State applicability

| State | Applicability | Reason |
|---|---|---|
| default | applicable |  |
| hover | applicable |  |
| focus-visible | applicable |  |
| disabled | applicable |  |
| loading | not-applicable | 옵션 칩은 즉시 렌더되어 로딩 상태가 없다 |
| error | not-applicable | 선택 오류는 담기 버튼 비활성으로 방지한다 |
| success | not-applicable | 선택 성공은 반전 상태로 표현한다 |

### Component: product-card

**Semantics:** 상품 목록 타일. 3:4 이미지가 주인공이며 호버 시 이미지가 1.04배 확대되고, 캡션은 대문자 카테고리·상품명·가격 순으로 아래에 놓인다. 테두리·그림자·라운드 없음.

- Anatomy: 3:4 이미지, 카테고리(대문자), 상품명, 가격
- States: default, hover, focus-visible, loading
- Token references: color.image-surface, text.base-size, tracking.label, motion.image, radius.none

- Interaction kind: interactive

#### State applicability

| State | Applicability | Reason |
|---|---|---|
| default | applicable |  |
| hover | applicable |  |
| focus-visible | applicable |  |
| disabled | not-applicable | 상품 카드에는 비활성 상태가 없다 |
| loading | applicable |  |
| error | not-applicable | 로드 실패는 이미지 배경(#f0f0f0)이 유지된다 |
| success | not-applicable | 카드는 성공 상태를 갖지 않는다 |

### Component: text-input

**Semantics:** 폼 입력. 스토어프론트는 밑줄(border-bottom)만 쓰고 포커스 시 잉크로 진해지며, 관리자 입력은 1px 테두리 + 4px 라운드다. 오류는 필드 아래 붉은 텍스트로 안내한다.

- Anatomy: 라벨(대문자), 입력 필드
- Variants: underline(스토어프론트), bordered(관리자)
- States: default, focus-visible, error
- Token references: color.hairline, color.ink, color.error, radius.input, radius.none

- Interaction kind: interactive

#### State applicability

| State | Applicability | Reason |
|---|---|---|
| default | applicable |  |
| hover | not-applicable | 입력 필드는 별도 호버 스타일 없이 포커스로 상태를 표현한다 |
| focus-visible | applicable |  |
| disabled | not-applicable | 입력 필드에는 비활성 스타일이 정의되어 있지 않다 |
| loading | not-applicable | 입력은 로딩 상태를 갖지 않는다 |
| error | applicable |  |
| success | not-applicable | 성공은 화면 단위 메시지로 표현한다 |

### Component: pagination-button

**Semantics:** 목록 페이지네이션 버튼. 현재 페이지는 잉크 반전으로 강조하고, 처음/끝에서는 비활성 처리한다.

- Anatomy: 페이지 번호
- Variants: active(잉크 반전)
- States: default, hover, focus-visible, disabled
- Token references: color.ink, color.hairline, color.canvas, radius.none

- Interaction kind: interactive

#### State applicability

| State | Applicability | Reason |
|---|---|---|
| default | applicable |  |
| hover | applicable |  |
| focus-visible | applicable |  |
| disabled | applicable |  |
| loading | not-applicable | 페이지 전환은 목록 refetch로 처리되어 버튼 자체 로딩은 없다 |
| error | not-applicable | 버튼은 오류 상태를 갖지 않는다 |
| success | not-applicable | 버튼은 성공 상태를 갖지 않는다 |

### Component: order-status-badge

**Semantics:** 주문 상태를 표시만 하는 비상호작용 라벨. 5개 상태별로 옅은 배경 + 진한 글자 쌍을 쓰고 2px 라운드다.

- Anatomy: 상태 텍스트
- Variants: pending, paid, shipped, delivered, cancelled
- States: default
- Token references: color.status.pending.bg, color.status.paid.bg, color.status.shipped.bg, color.status.delivered.bg, color.status.cancelled.bg, radius.badge

- Interaction kind: non-interactive
- Interaction reason: 상태를 표시만 하는 정적 라벨이라 상호작용 상태가 없다

### Rules

- 인터랙티브 요소는 default/hover/focus-visible/disabled를 기본으로 정의한다

- 선택·활성 상태는 잉크 반전(잉크 배경 + 흰 글자)으로 일관되게 표현한다

- 전이는 0.15–0.2s로 짧게, 상품 이미지 확대만 0.5s를 쓴다

<!-- design-md:section layout-platforms -->
## 5. Layout & Platforms

### Responsive constraints

- Minimum supported width: 320px
- Reflow target: 200% zoom

### Layout rules

- 콘텐츠 최대 폭은 스토어프론트 1400px, 관리자 대시보드 1760px이며 가운데 정렬한다

- 상품 그리드는 4→3→2→1열로 반응한다(900/768/400px 경계)

- 헤더는 데스크톱 3존 그리드(좌 내비 · 중앙 워드마크 · 우 유틸)에서 모바일 햄버거 패널로 전환한다

- 넓은 표는 좁은 화면에서 페이지 전체가 아니라 표 내부만 가로 스크롤한다(.table-scroll)

### Platform: web

- React(Vite) SPA
- 브레이크포인트 900 / 768 / 600 / 400px
- 관리자 대시보드는 좌측 사이드바 + 콘텐츠 레이아웃

<!-- design-md:section content-locales -->
## 6. Content & Locales

### Voice

- 간결하고 사실적인 한국어를 쓰고, 카테고리·라벨은 명사 위주로 표기한다

- 상태·오류 메시지는 무엇이 필요한지 구체적으로 안내한다(예: 유효한 이메일을 입력하세요)

- 느낌표나 과장 없이 담백하게 쓴다

### Terminology

| Term | Preferred form |
|---|---|
| 배송 타임라인 | 배송 단계(수거→간선상차→배송출발→배송완료) |
| 장바구니 | 장바구니(카트로 표기하지 않는다) |
| 주문 조회 | 주문 조회(게스트) / 마이페이지(로그인) |

### Locale: ko (supported)

- 기본 로케일
- 본문은 Noto Sans KR로 렌더한다

<!-- design-md:section governance -->
## 7. Governance

<!-- design-md:claim authority kind=project-system lang=en -->
### Authority

This document is the project design contract for the declared scope.
<!-- design-md:claim-end -->

<!-- design-md:claim application-priority order=prompt-fact,repository-fact,system-contract,reference-inspiration lang=en -->
### Application priority

1. Direct user instructions for the requested scope.
2. Repository facts.
3. This system contract.
4. Reference inspiration.
<!-- design-md:claim-end -->

<!-- design-md:claim unknowns policy=absent-at-smallest-unresolved-boundary lang=en -->
### Unknowns

Omit only the smallest unresolved value or group. Do not replace it with a plausible default.
<!-- design-md:claim-end -->

<!-- design-md:claim changes policy=review-record-validate-before-adoption lang=en -->
### Changes

Record, review, and validate changes before adoption.
<!-- design-md:claim-end -->

### Project priority details

1. 스토어프론트의 상품 중심·플랫 미학을 관리자 대시보드보다 우선한다

2. 접근성 대비(본문 4.5:1)를 색 선호보다 우선한다

### Additional change rules

- 토큰 값 변경은 index.css/App.css의 실제 값과 함께 갱신한다

### Decision provenance

- /identity/kind — prompt-fact; evidence: 사용자가 omd:init에서 '프로젝트 디자인 시스템으로 설정'을 선택함
- /foundations/tokens/radius.none — repository-fact; evidence: frontend/src/App.css 스토어프론트 .btn/.option-btn/.form-input border-radius 0
- /content_locales/voice — verified-reference-inspiration; evidence: farfetch DESIGN.md §10 Voice & Tone: 명사 위주·비과장 톤 참고
