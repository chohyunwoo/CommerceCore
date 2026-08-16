import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmPayment } from '../api/orders';
import { ApiError } from '../api/client';

type State = 'loading' | 'success' | 'error';

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<State>('loading');
  const [orderNumber, setOrderNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const paymentKey = searchParams.get('paymentKey') ?? '';
    const orderId = searchParams.get('orderId') ?? '';
    const amount = Number(searchParams.get('amount') ?? '0');

    confirmPayment(paymentKey, orderId, amount)
      .then((result) => {
        setOrderNumber(result.orderNumber);
        setState('success');
      })
      .catch((err: unknown) => {
        setErrorMsg(
          err instanceof ApiError ? err.message : '결제 승인에 실패했습니다.',
        );
        setState('error');
      });
  }, [searchParams]);

  if (state === 'loading') {
    return (
      <section id="order-complete">
        <p style={{ color: 'var(--text-sub)' }}>결제 승인 처리 중...</p>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section id="order-complete">
        <h1 className="complete-title">결제 승인 실패</h1>
        <p className="error" style={{ marginBottom: '24px' }}>{errorMsg}</p>
        <Link to="/" className="btn">홈으로 돌아가기</Link>
      </section>
    );
  }

  return (
    <section id="order-complete">
      <h1 className="complete-title">결제가 완료되었습니다.</h1>
      <p className="complete-order-num">주문번호 {orderNumber}</p>
      <div className="complete-links">
        <Link to="/" className="btn">계속 쇼핑하기</Link>
        <Link to="/orders/lookup" className="btn btn-filled">주문 조회하기</Link>
      </div>
    </section>
  );
}
