import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProduct } from '../api/products';
import { addCartItem } from '../api/cart';
import { ApiError } from '../api/client';
import type { ProductDetail } from '../api/types';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(
    null,
  );
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
          err instanceof ApiError
            ? err.message
            : '상품 정보를 불러오지 못했습니다.',
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  function handleAddToCart() {
    if (selectedOptionId === null) {
      return;
    }

    setAddingToCart(true);
    setCartMessage(null);

    addCartItem(selectedOptionId, quantity)
      .then(() => setCartMessage('장바구니에 담았습니다.'))
      .catch((err: unknown) => {
        setCartMessage(
          err instanceof ApiError
            ? err.message
            : '장바구니에 담지 못했습니다.',
        );
      })
      .finally(() => setAddingToCart(false));
  }

  if (loading) {
    return <p>불러오는 중...</p>;
  }

  if (error) {
    return (
      <section id="product-detail">
        <p className="error">{error}</p>
        <Link to="/">목록으로 돌아가기</Link>
      </section>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <section id="product-detail">
      <Link to="/">목록으로 돌아가기</Link>
      <p className="product-category">{product.category.name}</p>
      <h1>{product.name}</h1>
      <p className="product-price">{product.basePrice.toLocaleString()}원</p>
      {product.description && <p>{product.description}</p>}

      <table className="option-table">
        <thead>
          <tr>
            <th></th>
            <th>사이즈</th>
            <th>색상</th>
            <th>재고</th>
          </tr>
        </thead>
        <tbody>
          {product.options.map((option) => (
            <tr key={option.id}>
              <td>
                <input
                  type="radio"
                  name="productOption"
                  disabled={option.stock === 0}
                  checked={selectedOptionId === option.id}
                  onChange={() => setSelectedOptionId(option.id)}
                />
              </td>
              <td>{option.size}</td>
              <td>{option.color}</td>
              <td>{option.stock > 0 ? option.stock : '품절'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="add-to-cart">
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
        />
        <button
          type="button"
          disabled={selectedOptionId === null || addingToCart}
          onClick={handleAddToCart}
        >
          {addingToCart ? '담는 중...' : '장바구니 담기'}
        </button>
      </div>

      {cartMessage && <p className="cart-message">{cartMessage}</p>}
    </section>
  );
}
