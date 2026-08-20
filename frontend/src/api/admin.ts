import { apiGet, apiPatch, apiPost, apiPostForm } from './client';
import type {
  CategoryItem,
  CreateProductPayload,
  Product,
  RecentOrderItem,
  StockOverviewItem,
  UploadImageResult,
} from './types';

export function getAdminToken(): string {
  return localStorage.getItem('adminToken') ?? '';
}

function adminHeaders(): Record<string, string> {
  return { 'X-Admin-Token': getAdminToken() };
}

export function fetchStockOverview(): Promise<StockOverviewItem[]> {
  return apiGet<StockOverviewItem[]>('/admin/stock-overview', adminHeaders());
}

export function fetchRecentOrders(): Promise<RecentOrderItem[]> {
  return apiGet<RecentOrderItem[]>('/admin/orders/recent', adminHeaders());
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
