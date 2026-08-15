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
      <div className="form-page">
        <p style={{ color: 'var(--text-sub)', marginBottom: '24px' }}>
          주문할 상품 정보가 없습니다.
        </p>
        <Link to="/cart" className="btn">장바구니로 돌아가기</Link>
      </div>
    );
  }

  const { items } = state;
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    createOrder({ buyerEmail, buyerName, buyerPhone, buyerAddress }, items)
      .then((result) => navigate('/order-complete', { state: result }))
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : '주문 생성에 실패했습니다.',
        );
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="form-page">
      <h1 className="page-title">주문서 작성</h1>

      <ul className="form-summary">
        {items.map((item) => (
          <li key={item.productOptionId}>
            {item.productName} ({item.size} / {item.color}) × {item.quantity}
          </li>
        ))}
      </ul>
      <p className="form-total">{totalAmount.toLocaleString()}원</p>

      <form className="checkout-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">이메일</label>
          <input
            className="form-input"
            type="email"
            required
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">이름</label>
          <input
            className="form-input"
            type="text"
            required
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">전화번호</label>
          <input
            className="form-input"
            type="text"
            required
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">배송지</label>
          <input
            className="form-input"
            type="text"
            required
            value={buyerAddress}
            onChange={(e) => setBuyerAddress(e.target.value)}
          />
        </div>

        {error && <p className="error" style={{ marginBottom: '16px' }}>{error}</p>}

        <button type="submit" className="form-submit" disabled={submitting}>
          {submitting ? '주문 처리 중...' : '주문 완료'}
        </button>
      </form>
    </div>
  );
}
