import { apiGet } from './client';
import type { RecentOrderItem, StockOverviewItem } from './types';

export function fetchStockOverview(): Promise<StockOverviewItem[]> {
  return apiGet<StockOverviewItem[]>('/admin/stock-overview');
}

export function fetchRecentOrders(): Promise<RecentOrderItem[]> {
  return apiGet<RecentOrderItem[]>('/admin/orders/recent');
}
