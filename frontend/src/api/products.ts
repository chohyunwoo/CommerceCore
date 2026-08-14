import { apiGet } from './client';
import type { Product, ProductDetail } from './types';

export function fetchProducts(category?: string): Promise<Product[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiGet<Product[]>(`/products${query}`);
}

export function fetchProduct(id: number): Promise<ProductDetail> {
  return apiGet<ProductDetail>(`/products/${id}`);
}
