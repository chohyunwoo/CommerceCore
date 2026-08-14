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
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail extends Product {
  options: ProductOption[];
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
