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
