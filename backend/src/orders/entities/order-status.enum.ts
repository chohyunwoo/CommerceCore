export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  // 결제하지 않고 방치된 PENDING 주문을 만료 회수하며 부여하는 상태(결정 45).
  // 재고는 반납되고, 사용자·관리자 조회 뷰에는 노출되지 않는다.
  EXPIRED = 'EXPIRED',
}

// 사용자(마이페이지·게스트 조회)와 관리자 처리 목록에서 숨기는 상태(결정 44/45).
// 결제 미완료(PENDING)와 그 만료본(EXPIRED)은 "완료되지 않은 시도"라 주문으로 보이지 않는다.
export const HIDDEN_ORDER_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.EXPIRED,
] as const;
