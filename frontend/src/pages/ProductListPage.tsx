import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts } from '../api/products';
import { ApiError } from '../api/client';
import type { Product } from '../api/types';

const CATEGORIES = ['신발', '상의', '하의'];
const LIMIT = 12;

function getProductImage(productId: number): string {
  return `https://picsum.photos/seed/cc-${productId}/600/750`;
}

export function ProductListPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts(selectedCategory ?? undefined, page, LIMIT)
      .then(({ items, totalPages: tp }) => {
        setProducts(items);
        setTotalPages(tp);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : '상품을 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  }, [selectedCategory, page]);

  function handleCategoryChange(category: string | null) {
    setSelectedCategory(category);
    setPage(1);
  }

  function getPageNumbers(): number[] {
    const delta = 2;
    const start = Math.max(1, page - delta);
    const end = Math.min(totalPages, page + delta);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  return (
    <section id="product-list">
      <div className="category-filter">
        <button
          type="button"
          className={selectedCategory === null ? 'active' : ''}
          onClick={() => handleCategoryChange(null)}
        >
          All
        </button>
        {CATEGORIES.map((name) => (
          <button
            key={name}
            type="button"
            className={selectedCategory === name ? 'active' : ''}
            onClick={() => handleCategoryChange(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {loading && (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>불러오는 중...</p>
      )}
      {error && <p className="error">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>등록된 상품이 없습니다.</p>
      )}

      <ul className="product-grid">
        {products.map((product) => (
          <li key={product.id} className="product-card">
            <Link to={`/products/${product.id}`}>
              <div className="product-thumb">
                <img
                  src={getProductImage(product.id)}
                  alt={product.name}
                  loading="lazy"
                />
              </div>
              <p className="product-category">{product.category.name}</p>
              <p className="product-name">{product.name}</p>
              <p className="product-price">{product.basePrice.toLocaleString()}원</p>
            </Link>
          </li>
        ))}
      </ul>

      {!loading && !error && totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
          >
            이전
          </button>

          {getPageNumbers().map((p) => (
            <button
              key={p}
              type="button"
              className={`pagination-btn${p === page ? ' active' : ''}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            className="pagination-btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
          >
            다음
          </button>
        </div>
      )}
    </section>
  );
}
