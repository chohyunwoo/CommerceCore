import { apiGet, apiPost } from './client';
import { getCartId } from '../lib/cartId';
import { getSessionToken } from './auth';
import type {
  CartItem,
  ConfirmPaymentResult,
  CreateOrderResult,
  OrderLookupResult,
  PaginatedMyOrders,
  ValidateStockResult,
} from './types';

function sessionHeaders(): Record<string, string> {
  const sessionToken = getSessionToken();
  return sessionToken ? { 'X-Session-Token': sessionToken } : {};
}

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
  postalCode: string;
  baseAddress: string;
  detailAddress?: string;
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
    { 'X-Cart-Id': getCartId(), ...sessionHeaders() },
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

export function fetchMyOrders(
  page = 1,
  limit = 10,
): Promise<PaginatedMyOrders> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiGet<PaginatedMyOrders>(
    `/orders/my?${params.toString()}`,
    sessionHeaders(),
  );
}

export function fetchMyOrderDetail(
  orderNumber: string,
): Promise<OrderLookupResult> {
  return apiGet<OrderLookupResult>(
    `/orders/my/${orderNumber}`,
    sessionHeaders(),
  );
}
