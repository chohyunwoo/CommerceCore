const CART_ID_STORAGE_KEY = 'cartId';

export function getCartId(): string {
  const existing = localStorage.getItem(CART_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const cartId = crypto.randomUUID();
  localStorage.setItem(CART_ID_STORAGE_KEY, cartId);
  return cartId;
}
