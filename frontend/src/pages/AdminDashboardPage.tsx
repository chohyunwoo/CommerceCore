import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api/client';
import { fetchRecentOrders, fetchStockOverview, updateOrderStatus } from '../api/admin';
import type { RecentOrderItem, StockOverviewItem } from '../api/types';

const RECENT_ORDERS_LIMIT = 20;

type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

interface NextAction {
  label: string;
  status: OrderStatus;
  variant: 'primary' | 'danger';
}

const NEXT_ACTIONS: Record<OrderStatus, NextAction[]> = {
  PENDING: [
    { label: '결제 확인', status: 'PAID', variant: 'primary' },
    { label: '취소', status: 'CANCELLED', variant: 'danger' },
  ],
  PAID: [
    { label: '배송 시작', status: 'SHIPPED', variant: 'primary' },
    { label: '취소', status: 'CANCELLED', variant: 'danger' },
  ],
  SHIPPED: [{ label: '배송 완료', status: 'DELIVERED', variant: 'primary' }],
  DELIVERED: [],
  CANCELLED: [],
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  SHIPPED: '배송 중',
  DELIVERED: '배송 완료',
  CANCELLED: '취소됨',
};

export function AdminDashboardPage() {
  const [stock, setStock] = useState<StockOverviewItem[]>([]);
  const [orders, setOrders] = useState<RecentOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchStockOverview(), fetchRecentOrders()])
      .then(([stockOverview, recentOrders]) => {
        setStock(stockOverview);
        setOrders(recentOrders);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const source = new EventSource(`${API_BASE_URL}/admin/events`);

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.addEventListener('stock-update', (event) => {
      const update = JSON.parse(event.data) as StockOverviewItem;
      setStock((prev) => {
        const exists = prev.some(
          (item) => item.productOptionId === update.productOptionId,
        );
        if (!exists) return [...prev, update];
        return prev.map((item) =>
          item.productOptionId === update.productOptionId ? update : item,
        );
      });
    });

    source.addEventListener('order-update', (event) => {
      const newOrder = JSON.parse(event.data) as RecentOrderItem;
      setOrders((prev) =>
        [
          newOrder,
          ...prev.filter((order) => order.orderNumber !== newOrder.orderNumber),
        ].slice(0, RECENT_ORDERS_LIMIT),
      );
    });

    return () => source.close();
  }, []);

  async function handleStatusChange(orderNumber: string, status: OrderStatus) {
    setUpdating(orderNumber);
    try {
      await updateOrderStatus(orderNumber, status);
      // SSE가 연결돼 있으면 자동 반영, 연결 안 됐으면 로컬 업데이트
      if (!connected) {
        setOrders((prev) =>
          prev.map((o) =>
            o.orderNumber === orderNumber ? { ...o, status } : o,
          ),
        );
      }
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <section id="admin-dashboard">
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>불러오는 중...</p>
      </section>
    );
  }

  return (
    <section id="admin-dashboard">
      <div className="admin-header">
        <h1 className="admin-title">Dashboard</h1>
        <div className="sse-badge">
          <span className={`sse-dot${connected ? ' live' : ''}`} />
          {connected ? '실시간 연동 중' : '연결 끊김'}
        </div>
      </div>

      <p className="admin-section-title">재고 현황</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>상품</th>
            <th>사이즈</th>
            <th>색상</th>
            <th>재고</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((item) => (
            <tr key={item.productOptionId}>
              <td>{item.productName}</td>
              <td>{item.size}</td>
              <td>{item.color}</td>
              <td className={item.stock === 0 ? 'stock-zero' : ''}>
                {item.stock > 0 ? item.stock : '품절'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="admin-section-title">최근 주문</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>주문번호</th>
            <th>상태</th>
            <th>구매자</th>
            <th>합계</th>
            <th>시각</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const status = order.status as OrderStatus;
            const actions = NEXT_ACTIONS[status] ?? [];
            const isUpdating = updating === order.orderNumber;

            return (
              <tr key={order.orderNumber}>
                <td>{order.orderNumber}</td>
                <td>
                  <span className={`order-status-badge status-${status.toLowerCase()}`}>
                    {STATUS_LABEL[status] ?? status}
                  </span>
                </td>
                <td>{order.buyerName}</td>
                <td>{order.totalAmount.toLocaleString()}원</td>
                <td>{new Date(order.createdAt).toLocaleTimeString()}</td>
                <td>
                  <div className="order-actions">
                    {actions.map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        className={`order-action-btn ${action.variant}`}
                        disabled={isUpdating}
                        onClick={() =>
                          void handleStatusChange(order.orderNumber, action.status)
                        }
                      >
                        {isUpdating ? '...' : action.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
