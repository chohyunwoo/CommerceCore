import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import type { OrderCompleteState } from '../api/types';

const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSSPAYMENTS_CLIENT_KEY as string;

export function OrderCompletePage() {
  const location = useLocation();
  const result = location.state as OrderCompleteState | null;
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handlePay() {
    if (!result) return;
    setPaying(true);
    setError(null);
    try {
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey: ANONYMOUS });
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: result.totalAmount },
        orderId: result.orderNumber,
        orderName: 'CommerceCore 주문',
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerName: result.buyerName,
        customerEmail: result.buyerEmail,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '결제창 호출에 실패했습니다.';
      setError(msg);
      setPaying(false);
    }
  }

  return (
    <section id="order-complete">
      <h1 className="complete-title">주문이 완료되었습니다.</h1>
      <p className="complete-order-num">주문번호 {result.orderNumber}</p>
      <p className="complete-amount">{result.totalAmount.toLocaleString()}원</p>

      {error && <p className="error" style={{ marginBottom: '16px' }}>{error}</p>}

      <div className="complete-links">
        <Link to="/" className="btn">계속 쇼핑하기</Link>
        <Link to="/orders/lookup" className="btn">주문 조회하기</Link>
        <button
          className="btn btn-filled"
          onClick={handlePay}
          disabled={paying}
        >
          {paying ? '결제창 열기 중...' : '결제하기'}
        </button>
      </div>
    </section>
  );
}
