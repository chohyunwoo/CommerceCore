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
