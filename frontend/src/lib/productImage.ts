export function getProductImage(product: {
  id: number;
  imageUrl?: string | null;
}): string {
  return product.imageUrl ?? `https://picsum.photos/seed/cc-${product.id}/600/750`;
}
