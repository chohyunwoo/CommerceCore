import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api/client';
import { fetchRecentOrders, fetchStockOverview } from '../api/admin';
import type { RecentOrderItem, StockOverviewItem } from '../api/types';

const RECENT_ORDERS_LIMIT = 20;

export function AdminDashboardPage() {
  const [stock, setStock] = useState<StockOverviewItem[]>([]);
  const [orders, setOrders] = useState<RecentOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

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
        if (!exists) {
          return [...prev, update];
        }
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

  if (loading) {
    return <p>불러오는 중...</p>;
  }

  return (
    <section id="admin-dashboard">
      <h1>관리자 대시보드</h1>
      <p className={connected ? 'sse-status connected' : 'sse-status'}>
        {connected ? '실시간 연동 중' : '실시간 연결 끊김'}
      </p>

      <h2>재고 현황</h2>
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
              <td>{item.stock > 0 ? item.stock : '품절'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>최근 주문</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>주문번호</th>
            <th>상태</th>
            <th>구매자</th>
            <th>합계</th>
            <th>시각</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderNumber}>
              <td>{order.orderNumber}</td>
              <td>{order.status}</td>
              <td>{order.buyerName}</td>
              <td>{order.totalAmount.toLocaleString()}원</td>
              <td>{new Date(order.createdAt).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
