import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import { getCartId } from '../lib/cartId';
import type { Cart } from './types';

function cartHeaders(): Record<string, string> {
  return { 'X-Cart-Id': getCartId() };
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
