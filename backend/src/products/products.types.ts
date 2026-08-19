export interface ProductSearchResult {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  similarity: number;
}
