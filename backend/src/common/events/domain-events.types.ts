export interface StockUpdateEvent {
  productOptionId: number;
  productName: string;
  size: string;
  color: string;
  stock: number;
}

export interface OrderUpdateEvent {
  orderNumber: string;
  status: string;
  buyerName: string;
  totalAmount: number;
  createdAt: Date;
}

export type DomainEvent =
  | { type: 'stock-update'; data: StockUpdateEvent }
  | { type: 'order-update'; data: OrderUpdateEvent };
