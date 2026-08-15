import { apiGet, apiPatch } from './client';
import type { RecentOrderItem, StockOverviewItem } from './types';

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
): Promise<RecentOrderItem> {
  return apiPatch<RecentOrderItem>(`/admin/orders/${orderNumber}/status`, { status });
}
