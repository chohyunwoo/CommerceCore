import { Link, useSearchParams } from 'react-router-dom';

export function PaymentFailPage() {
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get('code') ?? '';
  const errorMessage = searchParams.get('message') ?? '결제에 실패했습니다.';

  return (
    <section id="order-complete">
      <h1 className="complete-title">결제 실패</h1>
      {errorCode && (
        <p style={{ color: 'var(--text-sub)', marginBottom: '8px' }}>
          오류 코드: {errorCode}
        </p>
      )}
      <p className="error" style={{ marginBottom: '24px' }}>{errorMessage}</p>
      <div className="complete-links">
        <Link to="/" className="btn">홈으로 돌아가기</Link>
        <Link to="/orders/lookup" className="btn btn-filled">주문 조회하기</Link>
      </div>
    </section>
  );
}
