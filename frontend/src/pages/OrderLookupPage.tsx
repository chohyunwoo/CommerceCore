import { useState } from 'react';
import { lookupOrder } from '../api/orders';
import { ApiError } from '../api/client';
import type { OrderLookupResult } from '../api/types';

export function OrderLookupPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderLookupResult | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOrder(null);
    lookupOrder(orderNumber, email)
      .then(setOrder)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : '주문 조회에 실패했습니다.',
        );
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="form-page">
      <h1 className="page-title">주문 조회</h1>

      <form className="checkout-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">주문번호</label>
          <input
            className="form-input"
            type="text"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="ORD-XXXXXXXX-XXXXXX"
          />
        </div>
        <div className="form-group">
          <label className="form-label">이메일</label>
          <input
            className="form-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && <p className="error" style={{ marginBottom: '16px' }}>{error}</p>}

        <button type="submit" className="form-submit" disabled={loading}>
          {loading ? '조회 중...' : '조회하기'}
        </button>
      </form>

      {order && (
        <div className="order-lookup-result">
          <p className="lookup-order-num">주문번호 {order.orderNumber}</p>
          <p className="lookup-status">{order.status}</p>

          <div className="lookup-info">
            <p>구매자: {order.buyerName} ({order.buyerEmail})</p>
            <p>연락처: {order.buyerPhone}</p>
            <p>배송지: {order.buyerAddress}</p>
          </div>

          <ul className="form-summary">
            {order.items.map((item, index) => (
              <li key={index}>
                {item.productName} ({item.size} / {item.color}) × {item.quantity} —{' '}
                {item.lineTotal.toLocaleString()}원
              </li>
            ))}
          </ul>

          <p style={{ textAlign: 'right', fontSize: '16px', paddingTop: '16px' }}>
            합계: {order.totalAmount.toLocaleString()}원
          </p>
        </div>
      )}
    </div>
  );
}
