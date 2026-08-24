export interface Category {
  id: number;
  name: string;
}

export interface ProductOption {
  id: number;
  productId: number;
  size: string;
  color: string;
  stock: number;
  sku: string;
}

export interface Product {
  id: number;
  categoryId: number;
  category: Category;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSearchResult {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  similarity: number;
}

export interface ProductDetail extends Product {
  options: ProductOption[];
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
}

export interface CartItem {
  productOptionId: number;
  productId: number;
  productName: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  lineTotal: number;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
}

export interface InsufficientStockItem {
  productOptionId: number;
  productName: string;
  size: string;
  color: string;
  requestedQuantity: number;
  availableStock: number;
}

export interface ValidateStockResult {
  valid: boolean;
  insufficientItems?: InsufficientStockItem[];
}

export interface CreateOrderResult {
  orderNumber: string;
  status: string;
  totalAmount: number;
}

export interface ConfirmPaymentResult {
  orderNumber: string;
  status: string;
}

export interface OrderLookupItem {
  productName: string;
  size: string;
  color: string;
  quantity: number;
  priceAtOrder: number;
  lineTotal: number;
}

export interface DeliveryEventItem {
  stage: string;
  location: string | null;
  occurredAt: string;
}

export interface OrderLookupResult {
  orderNumber: string;
  status: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerAddress: string;
  postalCode: string | null;
  baseAddress: string | null;
  detailAddress: string | null;
  totalAmount: number;
  createdAt: string;
  trackingNumber: string | null;
  carrier: string | null;
  deliveryEvents: DeliveryEventItem[];
  items: OrderLookupItem[];
}

export interface MyOrderItem {
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  trackingNumber: string | null;
  carrier: string | null;
}

export interface PaginatedMyOrders {
  items: MyOrderItem[];
  total: number;
  page: number;
  totalPages: number;
}

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
  createdAt: string;
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

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface AuthResult {
  token: string;
  user: CurrentUser;
}

export interface CreateProductOptionPayload {
  size: string;
  color: string;
  stock: number;
  sku: string;
}

export interface CreateProductPayload {
  categoryId: number;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl: string;
  imageEmbedding: number[];
  options: CreateProductOptionPayload[];
}

export interface UploadImageResult {
  url: string;
}

export interface AdminStats {
  summary: {
    totalRevenue: number;
    totalUnits: number;
    totalOrders: number;
  };
  revenueDaily: { date: string; revenue: number }[];
  revenueMonthly: { month: string; revenue: number }[];
  categoryRevenue: { categoryName: string; revenue: number }[];
  topProducts: { productName: string; revenue: number }[];
  orderStatusDistribution: { status: string; count: number }[];
}

export interface MemberItem {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
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
  lastOrderedAt: string;
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
