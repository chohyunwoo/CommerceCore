import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import { createOrder } from '../api/orders';
import { ApiError } from '../api/client';
import { openPostcodeSearch } from '../lib/kakaoPostcode';
import type { CartItem } from '../api/types';

interface CheckoutLocationState {
  items: CartItem[];
}

const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSSPAYMENTS_CLIENT_KEY as string;

export function CheckoutPage() {
  const location = useLocation();
  const state = location.state as CheckoutLocationState | null;

  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [baseAddress, setBaseAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
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

  async function handleSearchPostcode() {
    try {
      await openPostcodeSearch(({ postalCode: zonecode, baseAddress: road }) => {
        setPostalCode(zonecode);
        setBaseAddress(road);
      });
    } catch {
      setError('우편번호 검색을 열지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await createOrder(
        {
          buyerEmail,
          buyerName,
          buyerPhone,
          postalCode,
          baseAddress,
          detailAddress: detailAddress || undefined,
        },
        items,
      );

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey: ANONYMOUS });
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: result.totalAmount },
        orderId: result.orderNumber,
        orderName: 'CommerceCore 주문',
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerName: buyerName,
        customerEmail: buyerEmail,
      });
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : '처리 중 오류가 발생했습니다.',
      );
      setSubmitting(false);
    }
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
            inputMode="numeric"
            required
            maxLength={11}
            placeholder="01012345678"
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">우편번호</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="form-input"
              type="text"
              required
              readOnly
              placeholder="검색 버튼을 눌러주세요"
              value={postalCode}
            />
            <button
              type="button"
              className="btn"
              onClick={handleSearchPostcode}
            >
              우편번호 검색
            </button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">기본주소</label>
          <input
            className="form-input"
            type="text"
            required
            readOnly
            placeholder="검색 버튼을 눌러주세요"
            value={baseAddress}
          />
        </div>
        <div className="form-group">
          <label className="form-label">상세주소 (선택)</label>
          <input
            className="form-input"
            type="text"
            value={detailAddress}
            onChange={(e) => setDetailAddress(e.target.value)}
          />
        </div>

        {error && <p className="error" style={{ marginBottom: '16px' }}>{error}</p>}

        <button type="submit" className="form-submit" disabled={submitting}>
          {submitting ? '결제창 열기 중...' : '주문하기'}
        </button>
      </form>
    </div>
  );
}
