import { DeliveryEventItem } from '../orders/orders.types';

export interface StockOverviewItem {
  productOptionId: number;
  productName: string;
  categoryName: string;
  size: string;
  color: string;
  stock: number;
}

export interface RecentOrderItem {
  orderNumber: string;
  status: string;
  buyerName: string;
  totalAmount: number;
  createdAt: Date;
  trackingNumber: string | null;
  carrier: string | null;
  deliveryEvents: DeliveryEventItem[];
}

export interface PaginatedRecentOrders {
  items: RecentOrderItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CategoryItem {
  id: number;
  name: string;
}

export interface StatsSummary {
  totalRevenue: number;
  totalUnits: number;
  totalOrders: number;
}

export interface DailyRevenuePoint {
  date: string; // YYYY-MM-DD
  revenue: number;
}

export interface MonthlyRevenuePoint {
  month: string; // YYYY-MM
  revenue: number;
}

export interface CategoryRevenueItem {
  categoryName: string;
  revenue: number;
}

export interface TopProductItem {
  productName: string;
  revenue: number;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

export interface AdminStats {
  summary: StatsSummary;
  revenueDaily: DailyRevenuePoint[];
  revenueMonthly: MonthlyRevenuePoint[];
  categoryRevenue: CategoryRevenueItem[];
  topProducts: TopProductItem[];
  orderStatusDistribution: OrderStatusCount[];
}
