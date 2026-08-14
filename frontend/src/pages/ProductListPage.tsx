import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts } from '../api/products';
import { ApiError } from '../api/client';
import type { Product } from '../api/types';

export function ProductListPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    null,
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then((all) => {
        setCategories(Array.from(new Set(all.map((p) => p.category.name))));
      })
      .catch(() => {
        // 필터 목록은 부가 정보라 실패해도 목록 조회 자체는 계속 진행
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts(selectedCategory ?? undefined)
      .then(setProducts)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : '상품을 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  }, [selectedCategory]);

  return (
    <section id="product-list">
      <h1>상품 목록</h1>

      <div className="category-filter">
        <button
          type="button"
          className={selectedCategory === null ? 'active' : ''}
          onClick={() => setSelectedCategory(null)}
        >
          전체
        </button>
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            className={selectedCategory === name ? 'active' : ''}
            onClick={() => setSelectedCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && products.length === 0 && (
        <p>등록된 상품이 없습니다.</p>
      )}

      <ul className="product-grid">
        {products.map((product) => (
          <li key={product.id} className="product-card">
            <Link to={`/products/${product.id}`}>
              <p className="product-category">{product.category.name}</p>
              <h2>{product.name}</h2>
              <p className="product-price">
                {product.basePrice.toLocaleString()}원
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
