import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createOrder } from '../api/orders';
import { ApiError } from '../api/client';
import type { CartItem } from '../api/types';

interface CheckoutLocationState {
  items: CartItem[];
}

export function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CheckoutLocationState | null;

  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state || state.items.length === 0) {
    return (
      <section id="checkout">
        <p>주문할 상품 정보가 없습니다.</p>
        <Link to="/cart">장바구니로 돌아가기</Link>
      </section>
    );
  }

  const { items } = state;
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    createOrder({ buyerEmail, buyerName, buyerPhone, buyerAddress }, items)
      .then((result) => {
        navigate('/order-complete', { state: result });
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : '주문 생성에 실패했습니다.',
        );
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <section id="checkout">
      <h1>주문서 작성</h1>

      <ul className="checkout-summary">
        {items.map((item) => (
          <li key={item.productOptionId}>
            {item.productName} ({item.size} / {item.color}) × {item.quantity}
          </li>
        ))}
      </ul>
      <p className="cart-total">합계: {totalAmount.toLocaleString()}원</p>

      <form className="checkout-form" onSubmit={handleSubmit}>
        <label>
          이메일
          <input
            type="email"
            required
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
          />
        </label>
        <label>
          이름
          <input
            type="text"
            required
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
          />
        </label>
        <label>
          전화번호
          <input
            type="text"
            required
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(e.target.value)}
          />
        </label>
        <label>
          배송지
          <input
            type="text"
            required
            value={buyerAddress}
            onChange={(e) => setBuyerAddress(e.target.value)}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? '주문 처리 중...' : '주문 완료'}
        </button>
      </form>
    </section>
  );
}
