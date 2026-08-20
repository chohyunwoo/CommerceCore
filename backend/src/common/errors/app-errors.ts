export interface AppErrorDefinition {
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

export const AppErrors = {
  CART_ID_REQUIRED: {
    status: 400,
    code: 'CART_ID_REQUIRED',
    message: 'X-Cart-Id 헤더가 필요합니다.',
  },
  PRODUCT_OPTION_NOT_FOUND: {
    status: 404,
    code: 'PRODUCT_OPTION_NOT_FOUND',
    message: '상품 옵션을 찾을 수 없습니다.',
  },
  CART_ITEM_NOT_FOUND: {
    status: 404,
    code: 'CART_ITEM_NOT_FOUND',
    message: '장바구니에 없는 상품입니다.',
  },
  PRODUCT_NOT_FOUND: {
    status: 404,
    code: 'PRODUCT_NOT_FOUND',
    message: '상품을 찾을 수 없습니다.',
  },
  STOCK_INSUFFICIENT: {
    status: 409,
    code: 'STOCK_INSUFFICIENT',
    message: '재고가 부족합니다.',
  },
  ORDER_NOT_FOUND: {
    status: 404,
    code: 'ORDER_NOT_FOUND',
    message: '주문 정보를 찾을 수 없습니다.',
  },
  ORDER_NUMBER_GENERATION_FAILED: {
    status: 500,
    code: 'ORDER_NUMBER_GENERATION_FAILED',
    message: '주문번호 생성에 실패했습니다.',
  },
  PAYMENT_ALREADY_PROCESSED: {
    status: 400,
    code: 'PAYMENT_ALREADY_PROCESSED',
    message: '이미 처리된 주문입니다.',
  },
  PAYMENT_AMOUNT_MISMATCH: {
    status: 400,
    code: 'PAYMENT_AMOUNT_MISMATCH',
    message: '결제 금액이 주문 금액과 일치하지 않습니다.',
  },
  PAYMENT_PG_CONFIRM_FAILED: {
    status: 400,
    code: 'PAYMENT_PG_CONFIRM_FAILED',
    message: 'TossPayments 승인에 실패했습니다.',
  },
  PAYMENT_CANCEL_FAILED: {
    status: 400,
    code: 'PAYMENT_CANCEL_FAILED',
    message: 'TossPayments 결제 취소에 실패했습니다.',
  },
  ORDER_STATUS_TRANSITION_INVALID: {
    status: 400,
    code: 'ORDER_STATUS_TRANSITION_INVALID',
    message: '허용되지 않는 주문 상태 전이입니다.',
  },
  ADMIN_AUTH_REQUIRED: {
    status: 401,
    code: 'ADMIN_AUTH_REQUIRED',
    message: '관리자 인증이 필요합니다.',
  },
  CATEGORY_NOT_FOUND: {
    status: 404,
    code: 'CATEGORY_NOT_FOUND',
    message: '카테고리를 찾을 수 없습니다.',
  },
  SKU_ALREADY_EXISTS: {
    status: 409,
    code: 'SKU_ALREADY_EXISTS',
    message: '이미 존재하는 SKU입니다.',
  },
  INVALID_IMAGE_FILE: {
    status: 400,
    code: 'INVALID_IMAGE_FILE',
    message: '이미지 파일(JPEG/PNG/WEBP)만 업로드할 수 있습니다.',
  },
  IMAGE_UPLOAD_FAILED: {
    status: 500,
    code: 'IMAGE_UPLOAD_FAILED',
    message: '이미지 업로드에 실패했습니다.',
  },
  DELIVERY_EVENT_ORDER_NOT_SHIPPED: {
    status: 400,
    code: 'DELIVERY_EVENT_ORDER_NOT_SHIPPED',
    message: '배송 중(SHIPPED) 상태의 주문에만 배송 단계를 기록할 수 있습니다.',
  },
  DELIVERY_STAGE_ORDER_INVALID: {
    status: 400,
    code: 'DELIVERY_STAGE_ORDER_INVALID',
    message: '배송 단계 순서를 건너뛰거나 중복 기록할 수 없습니다.',
  },
} as const satisfies Record<string, AppErrorDefinition>;
