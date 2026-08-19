import { apiGet, apiPost } from './client';
import type {
  PaginatedProducts,
  ProductDetail,
  ProductSearchResult,
} from './types';

export function fetchProducts(
  category?: string,
  page = 1,
  limit = 12,
): Promise<PaginatedProducts> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  params.set('page', String(page));
  params.set('limit', String(limit));
  return apiGet<PaginatedProducts>(`/products?${params}`);
}

export function fetchProduct(id: number): Promise<ProductDetail> {
  return apiGet<ProductDetail>(`/products/${id}`);
}

export function searchProductsByImage(
  embedding: number[],
): Promise<ProductSearchResult[]> {
  return apiPost<ProductSearchResult[]>('/products/search-by-image', {
    embedding,
  });
}
