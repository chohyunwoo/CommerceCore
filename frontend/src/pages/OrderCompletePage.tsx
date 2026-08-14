import { Link, useLocation } from 'react-router-dom';
import type { CreateOrderResult } from '../api/types';

export function OrderCompletePage() {
  const location = useLocation();
  const result = location.state as CreateOrderResult | null;

  if (!result) {
    return (
      <section id="order-complete">
        <p>주문 정보를 찾을 수 없습니다.</p>
        <Link to="/">상품 보러 가기</Link>
      </section>
    );
  }

  return (
    <section id="order-complete">
      <h1>주문이 완료되었습니다.</h1>
      <p className="order-number">주문번호: {result.orderNumber}</p>
      <p>결제 금액: {result.totalAmount.toLocaleString()}원</p>
      <Link to="/">상품 목록으로</Link>
    </section>
  );
}
