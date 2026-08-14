export interface CartItemResponse {
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

export interface CartResponse {
  items: CartItemResponse[];
  totalAmount: number;
}
