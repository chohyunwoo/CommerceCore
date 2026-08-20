import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchMyOrderDetail } from '../api/orders';
import { ApiError } from '../api/client';
import { OrderDetailView } from '../components/OrderDetailView';
import type { OrderLookupResult } from '../api/types';

export function MyOrderDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<OrderLookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !orderNumber) return;
    setLoading(true);
    setError(null);
    fetchMyOrderDetail(orderNumber)
      .then(setOrder)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : '주문 정보를 불러오지 못했습니다.',
        );
      })
      .finally(() => setLoading(false));
  }, [user, orderNumber]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="form-page">
      <h1 className="page-title">주문 상세</h1>
      {loading && (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>불러오는 중...</p>
      )}
      {error && <p className="error">{error}</p>}
      {order && <OrderDetailView order={order} />}
    </div>
  );
}
