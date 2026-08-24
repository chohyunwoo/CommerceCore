import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from './client';
import { getSessionToken } from './auth';
import type {
  AdminProductOptionItem,
  AdminStats,
  CategoryItem,
  CreateProductPayload,
  PaginatedAdminProducts,
  PaginatedBuyers,
  PaginatedMembers,
  PaginatedRecentOrders,
  Product,
  RecentOrderItem,
  StockOverviewItem,
  UploadImageResult,
} from './types';

// 정적 공유 토큰(X-Admin-Token) 대신 로그인 세션 + role='admin'으로 인증한다(결정 38).
function adminHeaders(): Record<string, string> {
  return { 'X-Session-Token': getSessionToken() };
}

export function fetchStockOverview(): Promise<StockOverviewItem[]> {
  return apiGet<StockOverviewItem[]>('/admin/stock-overview', adminHeaders());
}

export function fetchStats(): Promise<AdminStats> {
  return apiGet<AdminStats>('/admin/stats', adminHeaders());
}

export function fetchAdminProducts(
  page = 1,
  limit = 20,
  search?: string,
): Promise<PaginatedAdminProducts> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return apiGet<PaginatedAdminProducts>(
    `/admin/products?${params.toString()}`,
    adminHeaders(),
  );
}

export function softDeleteProduct(id: number): Promise<{ id: number }> {
  return apiDelete<{ id: number }>(`/admin/products/${id}`, adminHeaders());
}

export function updateOptionStock(
  productId: number,
  optionId: number,
  stock: number,
): Promise<AdminProductOptionItem> {
  return apiPatch<AdminProductOptionItem>(
    `/admin/products/${productId}/options/${optionId}`,
    { stock },
    adminHeaders(),
  );
}

export function addProductOption(
  productId: number,
  option: { size: string; color: string; stock: number; sku: string },
): Promise<AdminProductOptionItem> {
  return apiPost<AdminProductOptionItem>(
    `/admin/products/${productId}/options`,
    option,
    adminHeaders(),
  );
}

export function fetchMembers(
  page = 1,
  limit = 20,
  search?: string,
): Promise<PaginatedMembers> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return apiGet<PaginatedMembers>(
    `/admin/members?${params.toString()}`,
    adminHeaders(),
  );
}

export function fetchBuyers(
  page = 1,
  limit = 20,
  search?: string,
): Promise<PaginatedBuyers> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return apiGet<PaginatedBuyers>(
    `/admin/buyers?${params.toString()}`,
    adminHeaders(),
  );
}

export function fetchRecentOrders(
  status?: string,
  page = 1,
  limit = 20,
  search?: string,
): Promise<PaginatedRecentOrders> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  return apiGet<PaginatedRecentOrders>(
    `/admin/orders/recent?${params.toString()}`,
    adminHeaders(),
  );
}

// EventSource가 커스텀 헤더를 못 보내 세션 토큰을 URL에 그대로 실을 수 없다 — 대신
// 이 1회용 단기 티켓(TTL 30초)을 먼저 발급받아 ?ticket=으로 전달한다(결정 38).
export function issueSseTicket(): Promise<{ ticket: string }> {
  return apiPost<{ ticket: string }>('/admin/events/ticket', {}, adminHeaders());
}

export function updateOrderStatus(
  orderNumber: string,
  status: string,
  trackingNumber?: string,
  carrier?: string,
): Promise<RecentOrderItem> {
  return apiPatch<RecentOrderItem>(
    `/admin/orders/${orderNumber}/status`,
    { status, trackingNumber, carrier },
    adminHeaders(),
  );
}

export function addDeliveryEvent(
  orderNumber: string,
  stage: string,
  location?: string,
): Promise<RecentOrderItem> {
  return apiPost<RecentOrderItem>(
    `/admin/orders/${orderNumber}/delivery-events`,
    { stage, location },
    adminHeaders(),
  );
}

export function fetchCategories(): Promise<CategoryItem[]> {
  return apiGet<CategoryItem[]>('/admin/categories', adminHeaders());
}

export function uploadProductImage(file: File): Promise<UploadImageResult> {
  const formData = new FormData();
  formData.append('file', file);
  return apiPostForm<UploadImageResult>(
    '/admin/products/upload-image',
    formData,
    adminHeaders(),
  );
}

export function createProduct(payload: CreateProductPayload): Promise<Product> {
  return apiPost<Product>('/admin/products', payload, adminHeaders());
}
