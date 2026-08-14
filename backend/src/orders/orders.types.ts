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
