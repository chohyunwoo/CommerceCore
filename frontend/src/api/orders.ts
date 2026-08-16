import { apiGet, apiPost } from './client';
import { getCartId } from '../lib/cartId';
import type {
  CartItem,
  ConfirmPaymentResult,
  CreateOrderResult,
  OrderLookupResult,
  ValidateStockResult,
} from './types';

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

export function confirmPayment(
  paymentKey: string,
  orderId: string,
  amount: number,
): Promise<ConfirmPaymentResult> {
  return apiPost<ConfirmPaymentResult>('/payments/confirm', {
    paymentKey,
    orderId,
    amount,
  });
}

export function lookupOrder(
  orderNumber: string,
  email: string,
): Promise<OrderLookupResult> {
  const params = new URLSearchParams({ orderNumber, email });
  return apiGet<OrderLookupResult>(`/orders/lookup?${params.toString()}`);
}
