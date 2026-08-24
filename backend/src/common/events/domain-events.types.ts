import { DeliveryEventItem } from '../../orders/orders.types';

export interface StockUpdateEvent {
  productOptionId: number;
  productName: string;
  size: string;
  color: string;
  stock: number;
  // 신규 옵션 추가로 재고 목록에 없던 항목이 SSE로 들어올 때 카테고리 그룹핑에 쓰인다(이슈 #88).
  // 기존 옵션 재고 변경(주문/재입고)은 프론트가 기존 항목에 병합하므로 없어도 무방.
  categoryName?: string;
}

export interface OrderUpdateEvent {
  orderNumber: string;
  status: string;
  buyerName: string;
  totalAmount: number;
  createdAt: Date;
  trackingNumber?: string | null;
  carrier?: string | null;
  deliveryEvents?: DeliveryEventItem[];
}

export type DomainEvent =
  | { type: 'stock-update'; data: StockUpdateEvent }
  | { type: 'order-update'; data: OrderUpdateEvent };
