import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts } from '../api/products';
import type { ProductSort } from '../api/products';
import { ApiError } from '../api/client';
import { getProductImage } from '../lib/productImage';
import type { Product } from '../api/types';

const CATEGORIES = ['신발', '상의', '하의'];
const LIMIT = 12;

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'latest', label: '최신순' },
  { value: 'price_asc', label: '가격 낮은순' },
  { value: 'price_desc', label: '가격 높은순' },
  { value: 'name', label: '이름순' },
];

export function ProductListPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 검색/가격/정렬 — 검색·가격은 폼 제출 시 적용값(applied*)으로 반영해 매 타이핑마다 요청하지 않는다.
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [minInput, setMinInput] = useState('');
  const [maxInput, setMaxInput] = useState('');
  const [appliedMin, setAppliedMin] = useState<number | undefined>(undefined);
  const [appliedMax, setAppliedMax] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState<ProductSort>('latest');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts({
      category: selectedCategory ?? undefined,
      page,
      limit: LIMIT,
      search: appliedSearch || undefined,
      minPrice: appliedMin,
      maxPrice: appliedMax,
      sort,
    })
      .then(({ items, totalPages: tp }) => {
        setProducts(items);
        setTotalPages(tp);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : '상품을 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  }, [selectedCategory, page, appliedSearch, appliedMin, appliedMax, sort]);

  function handleCategoryChange(category: string | null) {
    setSelectedCategory(category);
    setPage(1);
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
    const min = minInput.trim() === '' ? undefined : Number(minInput);
    const max = maxInput.trim() === '' ? undefined : Number(maxInput);
    setAppliedMin(Number.isFinite(min) ? min : undefined);
    setAppliedMax(Number.isFinite(max) ? max : undefined);
    setPage(1);
  }

  function handleFilterReset() {
    setSearchInput('');
    setMinInput('');
    setMaxInput('');
    setAppliedSearch('');
    setAppliedMin(undefined);
    setAppliedMax(undefined);
    setPage(1);
  }

  function handleSortChange(next: ProductSort) {
    setSort(next);
    setPage(1);
  }

  const hasActiveFilter =
    appliedSearch !== '' || appliedMin !== undefined || appliedMax !== undefined;

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

      <div className="product-toolbar">
        <form className="product-filter-form" onSubmit={handleFilterSubmit}>
          <input
            type="text"
            className="product-search-input"
            placeholder="상품명 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <input
            type="number"
            min={0}
            className="product-price-input"
            placeholder="최소 가격"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
          />
          <span className="product-price-sep">~</span>
          <input
            type="number"
            min={0}
            className="product-price-input"
            placeholder="최대 가격"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
          />
          <button type="submit" className="product-filter-btn">
            적용
          </button>
          {hasActiveFilter && (
            <button
              type="button"
              className="product-filter-btn ghost"
              onClick={handleFilterReset}
            >
              초기화
            </button>
          )}
        </form>
        <select
          className="product-sort-select"
          value={sort}
          onChange={(e) => handleSortChange(e.target.value as ProductSort)}
          aria-label="정렬"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
                  src={getProductImage(product)}
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
