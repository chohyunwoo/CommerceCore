import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import { getCartId } from '../lib/cartId';
import { getSessionToken } from './auth';
import type { Cart } from './types';

function cartHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'X-Cart-Id': getCartId() };
  const sessionToken = getSessionToken();
  if (sessionToken) {
    headers['X-Session-Token'] = sessionToken;
  }
  return headers;
}

export function fetchCart(): Promise<Cart> {
  return apiGet<Cart>('/cart', cartHeaders());
}

export function addCartItem(
  productOptionId: number,
  quantity: number,
): Promise<Cart> {
  return apiPost<Cart>(
    '/cart/items',
    { productOptionId, quantity },
    cartHeaders(),
  );
}

export function updateCartItem(
  productOptionId: number,
  quantity: number,
): Promise<Cart> {
  return apiPatch<Cart>(
    `/cart/items/${productOptionId}`,
    { quantity },
    cartHeaders(),
  );
}

export function removeCartItem(productOptionId: number): Promise<Cart> {
  return apiDelete<Cart>(`/cart/items/${productOptionId}`, cartHeaders());
}
