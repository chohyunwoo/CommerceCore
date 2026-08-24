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

export interface MemberItem {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  orderCount: number;
}

export interface PaginatedMembers {
  items: MemberItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface BuyerItem {
  email: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  lastOrderedAt: Date;
}

export interface PaginatedBuyers {
  items: BuyerItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminProductOptionItem {
  id: number;
  size: string;
  color: string;
  stock: number;
  sku: string;
}

export interface AdminProductItem {
  id: number;
  name: string;
  categoryName: string;
  basePrice: number;
  imageUrl: string | null;
  totalStock: number;
  options: AdminProductOptionItem[];
}

export interface PaginatedAdminProducts {
  items: AdminProductItem[];
  total: number;
  page: number;
  totalPages: number;
}
