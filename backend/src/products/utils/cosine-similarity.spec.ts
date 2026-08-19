import { cosineSimilarity } from './cosine-similarity';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 1], [1, 0, 1])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1);
  });

  it('returns -1 when vector lengths differ', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(-1);
  });

  it('returns -1 when a vector is all zeros', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(-1);
  });
});
