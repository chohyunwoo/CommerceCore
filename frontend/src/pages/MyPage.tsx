import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchMyOrders } from '../api/orders';
import { ApiError } from '../api/client';
import type { MyOrderItem } from '../api/types';

const STATUS_LABEL: Record<string, string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  SHIPPED: '배송 중',
  DELIVERED: '배송 완료',
  CANCELLED: '취소됨',
};

const LIMIT = 10;

export function MyPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<MyOrderItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    fetchMyOrders(page, LIMIT)
      .then(({ items, totalPages: tp }) => {
        setOrders(items);
        setTotalPages(tp);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : '주문 목록을 불러오지 못했습니다.',
        );
      })
      .finally(() => setLoading(false));
  }, [user, page]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="form-page">
      <h1 className="page-title">마이페이지</h1>
      <p style={{ marginBottom: '24px', fontSize: '13px', color: 'var(--text-sub)' }}>
        {user.name}님, 안녕하세요.
      </p>

      {loading && (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>불러오는 중...</p>
      )}
      {error && <p className="error">{error}</p>}
      {!loading && !error && orders.length === 0 && (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>주문 내역이 없습니다.</p>
      )}

      {!loading && !error && orders.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>주문번호</th>
              <th>상태</th>
              <th>합계</th>
              <th>주문일시</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.orderNumber}>
                <td>
                  <Link to={`/my/orders/${order.orderNumber}`}>{order.orderNumber}</Link>
                </td>
                <td>{STATUS_LABEL[order.status] ?? order.status}</td>
                <td>{order.totalAmount.toLocaleString()}원</td>
                <td>{new Date(order.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
          >
            이전
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="pagination-btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
