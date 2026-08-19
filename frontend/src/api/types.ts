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

export interface OrderLookupResult {
  orderNumber: string;
  status: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerAddress: string;
  totalAmount: number;
  createdAt: string;
  items: OrderLookupItem[];
}

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
  createdAt: string;
}
