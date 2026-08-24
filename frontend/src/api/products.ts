import { apiGet, apiPost } from './client';
import type {
  PaginatedProducts,
  ProductDetail,
  ProductSearchResult,
} from './types';

export type ProductSort = 'latest' | 'price_asc' | 'price_desc' | 'name';

export interface FetchProductsParams {
  category?: string;
  page?: number;
  limit?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
}

export function fetchProducts(
  params: FetchProductsParams = {},
): Promise<PaginatedProducts> {
  const { category, page = 1, limit = 12, search, minPrice, maxPrice, sort } =
    params;
  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  qs.set('page', String(page));
  qs.set('limit', String(limit));
  if (search) qs.set('search', search);
  if (minPrice != null) qs.set('minPrice', String(minPrice));
  if (maxPrice != null) qs.set('maxPrice', String(maxPrice));
  if (sort) qs.set('sort', sort);
  return apiGet<PaginatedProducts>(`/products?${qs}`);
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
