import { apiPost } from './client';
import { getCartId } from '../lib/cartId';
import type { CartItem, CreateOrderResult, ValidateStockResult } from './types';

export function validateStock(items: CartItem[]): Promise<ValidateStockResult> {
  return apiPost<ValidateStockResult>('/orders/validate-stock', {
    items: items.map((item) => ({
      productOptionId: item.productOptionId,
      quantity: item.quantity,
    })),
  });
}

export interface BuyerInfo {
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
}

export function createOrder(
  buyer: BuyerInfo,
  items: CartItem[],
): Promise<CreateOrderResult> {
  return apiPost<CreateOrderResult>(
    '/orders',
    {
      ...buyer,
      items: items.map((item) => ({
        productOptionId: item.productOptionId,
        quantity: item.quantity,
      })),
    },
    { 'X-Cart-Id': getCartId() },
  );
}
