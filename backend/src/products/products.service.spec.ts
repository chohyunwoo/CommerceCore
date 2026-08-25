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
      { id: 2, name: 'B', imageEmbedding: [0.95, 0.05] },
      { id: 3, name: 'C', imageEmbedding: [0.9, 0.1] },
    ]);

    const results = await service.searchByImage([1, 0]);

    expect(results.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(results[0].similarity).toBeCloseTo(1);
  });

  it('excludes only clearly-unrelated products below the low floor', async () => {
    const service = createService([
      { id: 1, name: 'A', imageEmbedding: [1, 0] },
      { id: 2, name: 'B (orthogonal, unrelated)', imageEmbedding: [0, 1] },
    ]);

    const results = await service.searchByImage([1, 0]);

    // 직교(코사인 0)는 바닥값(0.15) 미만이라 제외
    expect(results.map((r) => r.id)).toEqual([1]);
  });

  it('하이브리드: 중간 유사도(구 0.40 컷오프 미만이나 바닥값 이상)도 포함한다', async () => {
    // [1,3] vs [1,0] → cos ≈ 0.316 (바닥값 0.15 이상, 옛 0.40 컷오프 미만)
    const service = createService([
      { id: 1, name: 'A', imageEmbedding: [1, 3] },
    ]);

    const results = await service.searchByImage([1, 0]);

    expect(results.map((r) => r.id)).toEqual([1]);
    expect(results[0].similarity).toBeCloseTo(0.316, 2);
  });

  it('does not leak the raw embedding array in the response shape', async () => {
    const service = createService([
      { id: 1, name: 'A', imageEmbedding: [1, 0] },
    ]);

    const results = await service.searchByImage([1, 0]);

    expect(results[0]).not.toHaveProperty('imageEmbedding');
  });
});
