import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchCart, removeCartItem, updateCartItem } from '../api/cart';
import { validateStock } from '../api/orders';
import { ApiError } from '../api/client';
import type { Cart, ValidateStockResult } from '../api/types';

export function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingStock, setCheckingStock] = useState(false);
  const [stockResult, setStockResult] = useState<ValidateStockResult | null>(null);

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
          err instanceof ApiError ? err.message : '장바구니를 불러오지 못했습니다.',
        );
      })
      .finally(() => setLoading(false));
  }

  function handleQuantityChange(productOptionId: number, quantity: number) {
    if (quantity < 1) return;
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

  function handlePlaceOrder() {
    if (!cart) return;
    setCheckingStock(true);
    setStockResult(null);
    validateStock(cart.items)
      .then(setStockResult)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : '재고 확인에 실패했습니다.',
        );
      })
      .finally(() => setCheckingStock(false));
  }

  if (loading) {
    return (
      <section id="cart">
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>불러오는 중...</p>
      </section>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <section id="cart">
        <h1 style={{ fontSize: '24px', fontWeight: 400, marginBottom: '24px' }}>
          장바구니
        </h1>
        <p style={{ color: 'var(--text-sub)', fontSize: '13px', marginBottom: '28px' }}>
          장바구니가 비어 있습니다.
        </p>
        <Link to="/" className="btn">쇼핑 계속하기</Link>
      </section>
    );
  }

  return (
    <section id="cart">
      <h1 style={{ fontSize: '24px', fontWeight: 400, marginBottom: '40px' }}>
        장바구니
      </h1>

      {error && <p className="error" style={{ marginBottom: '16px' }}>{error}</p>}

      <div className="table-scroll">
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
              <td style={{ color: 'var(--text-sub)' }}>
                {item.size} / {item.color}
              </td>
              <td>{item.unitPrice.toLocaleString()}원</td>
              <td>
                <input
                  className="cart-qty-input"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    handleQuantityChange(item.productOptionId, Number(e.target.value))
                  }
                />
              </td>
              <td>{item.lineTotal.toLocaleString()}원</td>
              <td>
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => handleRemove(item.productOptionId)}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="cart-footer">
        <div className="cart-summary">
          <p className="cart-total-label">합계</p>
          <p className="cart-total-amount">{cart.totalAmount.toLocaleString()}원</p>
          <button
            type="button"
            className="btn btn-filled"
            style={{ width: '100%' }}
            disabled={checkingStock}
            onClick={handlePlaceOrder}
          >
            {checkingStock ? '재고 확인 중...' : '주문하기'}
          </button>
        </div>
      </div>

      {stockResult?.valid && (
        <div className="stock-message stock-ok">
          <p>재고 확인 완료. 주문을 진행할 수 있습니다.</p>
          <button
            type="button"
            className="btn btn-filled btn-sm"
            onClick={() => navigate('/checkout', { state: { items: cart.items } })}
          >
            주문서 작성하기
          </button>
        </div>
      )}

      {stockResult && !stockResult.valid && (
        <div className="stock-message stock-insufficient">
          <p>재고가 부족한 상품이 있습니다.</p>
          <ul>
            {stockResult.insufficientItems?.map((item) => (
              <li key={item.productOptionId}>
                {item.productName} ({item.size} / {item.color}) — 요청{' '}
                {item.requestedQuantity}개, 가능 {item.availableStock}개
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
