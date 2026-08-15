import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProduct } from '../api/products';
import { addCartItem } from '../api/cart';
import { ApiError } from '../api/client';
import type { ProductDetail } from '../api/types';

function getProductImage(productId: number): string {
  return `https://picsum.photos/seed/cc-${productId}/600/750`;
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setProduct(null);
    setSelectedOptionId(null);
    setCartMessage(null);

    fetchProduct(Number(id))
      .then(setProduct)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : '상품 정보를 불러오지 못했습니다.',
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  function handleAddToCart() {
    if (selectedOptionId === null) return;
    setAddingToCart(true);
    setCartMessage(null);
    addCartItem(selectedOptionId, quantity)
      .then(() => setCartMessage('장바구니에 담았습니다.'))
      .catch((err: unknown) => {
        setCartMessage(
          err instanceof ApiError ? err.message : '장바구니에 담지 못했습니다.',
        );
      })
      .finally(() => setAddingToCart(false));
  }

  if (loading) {
    return (
      <section id="product-detail">
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>불러오는 중...</p>
      </section>
    );
  }

  if (error || !product) {
    return (
      <section id="product-detail">
        <Link to="/" className="back-link">← 목록으로</Link>
        <p className="error">{error}</p>
      </section>
    );
  }

  return (
    <section id="product-detail">
      <Link to="/" className="back-link">← 목록으로</Link>

      <div className="product-detail-grid">
        <div className="product-detail-image">
          <img src={getProductImage(product.id)} alt={product.name} />
        </div>

        <div className="product-detail-info">
          <p className="detail-category">{product.category.name}</p>
          <h1 className="detail-name">{product.name}</h1>
          <p className="detail-price">{product.basePrice.toLocaleString()}원</p>

          {product.description && (
            <p className="detail-description">{product.description}</p>
          )}

          <div className="option-section">
            <p className="option-section-label">옵션 선택</p>
            <div className="option-buttons">
              {product.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={[
                    'option-btn',
                    selectedOptionId === option.id ? 'selected' : '',
                    option.stock === 0 ? 'soldout' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={option.stock === 0}
                  onClick={() => setSelectedOptionId(option.id)}
                >
                  {option.size} / {option.color}
                  {option.stock === 0 && ' (품절)'}
                </button>
              ))}
            </div>
          </div>

          <div className="quantity-row">
            <span className="quantity-label">수량</span>
            <input
              className="qty-input"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <button
            type="button"
            className="btn-add-to-cart"
            disabled={selectedOptionId === null || addingToCart}
            onClick={handleAddToCart}
          >
            {addingToCart ? '담는 중...' : '장바구니 담기'}
          </button>

          {cartMessage && <p className="cart-message">{cartMessage}</p>}
        </div>
      </div>
    </section>
  );
}
