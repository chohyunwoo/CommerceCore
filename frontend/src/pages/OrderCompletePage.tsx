import { Link, useLocation } from 'react-router-dom';
import type { CreateOrderResult } from '../api/types';

export function OrderCompletePage() {
  const location = useLocation();
  const result = location.state as CreateOrderResult | null;

  if (!result) {
    return (
      <section id="order-complete">
        <p style={{ color: 'var(--text-sub)', marginBottom: '24px' }}>
          주문 정보를 찾을 수 없습니다.
        </p>
        <Link to="/" className="btn">상품 보러 가기</Link>
      </section>
    );
  }

  return (
    <section id="order-complete">
      <h1 className="complete-title">주문이 완료되었습니다.</h1>
      <p className="complete-order-num">주문번호 {result.orderNumber}</p>
      <p className="complete-amount">{result.totalAmount.toLocaleString()}원</p>
      <div className="complete-links">
        <Link to="/" className="btn">계속 쇼핑하기</Link>
        <Link to="/orders/lookup" className="btn btn-filled">주문 조회하기</Link>
      </div>
    </section>
  );
}
