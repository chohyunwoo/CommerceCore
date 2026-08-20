import { DeliveryEventItem } from '../orders/orders.types';

export interface StockOverviewItem {
  productOptionId: number;
  productName: string;
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

export interface CategoryItem {
  id: number;
  name: string;
}
