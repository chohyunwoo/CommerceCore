import { apiPost } from './client';
import type { CartItem, ValidateStockResult } from './types';

export function validateStock(items: CartItem[]): Promise<ValidateStockResult> {
  return apiPost<ValidateStockResult>('/orders/validate-stock', {
    items: items.map((item) => ({
      productOptionId: item.productOptionId,
      quantity: item.quantity,
    })),
  });
}
