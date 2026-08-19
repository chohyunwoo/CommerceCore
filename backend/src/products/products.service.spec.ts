import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

function createService(products: Partial<Product>[]) {
  const repository = {
    find: jest.fn().mockResolvedValue(products),
  };
  return new ProductsService(repository as never);
}

describe('ProductsService.searchByImage', () => {
  it('ranks products by cosine similarity, most similar first', async () => {
    const service = createService([
      { id: 1, name: 'A', imageEmbedding: [1, 0] },
      { id: 2, name: 'B', imageEmbedding: [0, 1] },
      { id: 3, name: 'C', imageEmbedding: [0.9, 0.1] },
    ]);

    const results = await service.searchByImage([1, 0]);

    expect(results.map((r) => r.id)).toEqual([1, 3, 2]);
    expect(results[0].similarity).toBeCloseTo(1);
  });

  it('does not leak the raw embedding array in the response shape', async () => {
    const service = createService([
      { id: 1, name: 'A', imageEmbedding: [1, 0] },
    ]);

    const results = await service.searchByImage([1, 0]);

    expect(results[0]).not.toHaveProperty('imageEmbedding');
  });
});
