import { useState } from 'react';
import { Link } from 'react-router-dom';
import { searchProductsByImage } from '../api/products';
import { getImageEmbedding } from '../lib/imageEmbedding';
import { getProductImage } from '../lib/productImage';
import { ApiError } from '../api/client';
import type { ProductSearchResult } from '../api/types';

// 이 값 이상이면 "확실히 비슷한 매치"로 보고, 미만이면 결과는 보여주되
// "정확히 일치하는 상품은 없지만 비슷한 순" 안내를 띄운다(결정 32 하이브리드).
const SIMILARITY_CONFIDENT = 0.3;

// 자동 카테고리 판정은 하의에서 신뢰도가 낮아(스파이크 확인), 사용자가 직접 좁힌다(결정 32).
const CATEGORIES = ['신발', '상의', '하의'];

export function ImageSearchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(''); // '' = 전체
  const [results, setResults] = useState<ProductSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(selected: File | null) {
    setFile(selected);
    setResults(null);
    setError(null);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleSearch() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      setStatusMessage('브라우저에서 이미지 분석 중...');
      const embedding = await getImageEmbedding(file);
      setStatusMessage('유사한 상품 찾는 중...');
      const found = await searchProductsByImage(embedding, category || undefined);
      setResults(found);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : '이미지 검색에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setStatusMessage(null);
      setLoading(false);
    }
  }

  return (
    <section id="image-search">
      <p className="detail-category">AI 이미지 검색</p>
      <h1 className="detail-name" style={{ marginBottom: '8px' }}>
        이미지로 비슷한 상품 찾기
      </h1>
      <p style={{ color: 'var(--text-sub)', fontSize: '13px', marginBottom: '32px' }}>
        상품 사진을 올리면 브라우저에서 직접 분석해 가장 비슷한 상품을 찾아드립니다.
        (첫 사용 시 모델을 내려받느라 다소 시간이 걸릴 수 있습니다.)
      </p>

      <div className="image-search-upload">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        {previewUrl && (
          <div className="image-search-preview">
            <img src={previewUrl} alt="업로드한 이미지 미리보기" />
          </div>
        )}
        <select
          className="product-sort-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="검색 카테고리"
        >
          <option value="">전체 카테고리</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-filled"
          disabled={!file || loading}
          onClick={handleSearch}
        >
          {loading ? statusMessage ?? '검색 중...' : '유사 상품 찾기'}
        </button>
      </div>
      <p style={{ color: 'var(--text-sub)', fontSize: '12px', marginTop: '10px' }}>
        카테고리를 선택하면 해당 카테고리 안에서만 시각적으로 비슷한 상품을 찾아
        더 정확합니다. (특히 상의·하의)
      </p>

      {error && <p className="error">{error}</p>}

      {results && results.length === 0 && (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px', marginTop: '24px' }}>
          유사한 상품을 찾지 못했습니다. 상품 사진에 가까운 이미지로 다시 시도해 주세요.
        </p>
      )}

      {results && results.length > 0 && results[0].similarity < SIMILARITY_CONFIDENT && (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px', marginTop: '24px' }}>
          정확히 일치하는 상품은 없지만, 가장 비슷한 순으로 보여드려요.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="product-grid" style={{ marginTop: '32px' }}>
          {results.map((product) => (
            <li key={product.id} className="product-card">
              <Link to={`/products/${product.id}`}>
                <div className="product-thumb">
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    loading="lazy"
                  />
                </div>
                <p className="product-name">{product.name}</p>
                <p className="product-price">{product.basePrice.toLocaleString()}원</p>
                <p className="similarity-badge">
                  유사도 {(product.similarity * 100).toFixed(1)}%
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
