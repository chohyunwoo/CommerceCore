import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCart, removeCartItem, updateCartItem } from '../api/cart';
import { ApiError } from '../api/client';
import type { Cart } from '../api/types';

export function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCart();
  }, []);

  function loadCart() {
    setLoading(true);
    setError(null);

    fetchCart()
      .then(setCart)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : '장바구니를 불러오지 못했습니다.',
        );
      })
      .finally(() => setLoading(false));
  }

  function handleQuantityChange(productOptionId: number, quantity: number) {
    if (quantity < 1) {
      return;
    }

    updateCartItem(productOptionId, quantity)
      .then(setCart)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : '수량을 변경하지 못했습니다.',
        );
      });
  }

  function handleRemove(productOptionId: number) {
    removeCartItem(productOptionId)
      .then(setCart)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : '항목을 삭제하지 못했습니다.',
        );
      });
  }

  if (loading) {
    return <p>불러오는 중...</p>;
  }

  if (error) {
    return (
      <section id="cart">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <section id="cart">
        <h1>장바구니</h1>
        <p>장바구니가 비어 있습니다.</p>
        <Link to="/">상품 보러 가기</Link>
      </section>
    );
  }

  return (
    <section id="cart">
      <h1>장바구니</h1>

      <table className="cart-table">
        <thead>
          <tr>
            <th>상품</th>
            <th>옵션</th>
            <th>단가</th>
            <th>수량</th>
            <th>합계</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cart.items.map((item) => (
            <tr key={item.productOptionId}>
              <td>{item.productName}</td>
              <td>
                {item.size} / {item.color}
              </td>
              <td>{item.unitPrice.toLocaleString()}원</td>
              <td>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    handleQuantityChange(
                      item.productOptionId,
                      Number(e.target.value),
                    )
                  }
                />
              </td>
              <td>{item.lineTotal.toLocaleString()}원</td>
              <td>
                <button
                  type="button"
                  onClick={() => handleRemove(item.productOptionId)}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="cart-total">합계: {cart.totalAmount.toLocaleString()}원</p>
    </section>
  );
}
