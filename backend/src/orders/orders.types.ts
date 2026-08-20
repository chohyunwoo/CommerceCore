export interface InsufficientStockItem {
  productOptionId: number;
  productName: string;
  size: string;
  color: string;
  requestedQuantity: number;
  availableStock: number;
}

export interface ValidateStockResponse {
  valid: boolean;
  insufficientItems?: InsufficientStockItem[];
}

export interface CreateOrderResponse {
  orderNumber: string;
  status: string;
  totalAmount: number;
}

export interface OrderLookupItem {
  productName: string;
  size: string;
  color: string;
  quantity: number;
  priceAtOrder: number;
  lineTotal: number;
}

export interface DeliveryEventItem {
  stage: string;
  location: string | null;
  occurredAt: Date;
}

export interface OrderLookupResponse {
  orderNumber: string;
  status: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerAddress: string;
  postalCode: string | null;
  baseAddress: string | null;
  detailAddress: string | null;
  totalAmount: number;
  createdAt: Date;
  trackingNumber: string | null;
  carrier: string | null;
  deliveryEvents: DeliveryEventItem[];
  items: OrderLookupItem[];
}
