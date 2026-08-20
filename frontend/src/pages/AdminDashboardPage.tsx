import { Fragment, useEffect, useState } from 'react';
import { API_BASE_URL, ApiError } from '../api/client';
import {
  addDeliveryEvent,
  fetchRecentOrders,
  fetchStockOverview,
  updateOrderStatus,
} from '../api/admin';
import type { RecentOrderItem, StockOverviewItem } from '../api/types';

const RECENT_ORDERS_LIMIT = 20;

type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
type DeliveryStage = 'COLLECTED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

interface NextAction {
  label: string;
  status: OrderStatus;
  variant: 'primary' | 'danger';
  requiresTracking?: boolean;
}

const NEXT_ACTIONS: Record<OrderStatus, NextAction[]> = {
  PENDING: [
    { label: '결제 확인', status: 'PAID', variant: 'primary' },
    { label: '취소', status: 'CANCELLED', variant: 'danger' },
  ],
  PAID: [
    {
      label: '배송 시작',
      status: 'SHIPPED',
      variant: 'primary',
      requiresTracking: true,
    },
    { label: '취소', status: 'CANCELLED', variant: 'danger' },
  ],
  // SHIPPED 이후로는 상태를 직접 바꾸지 않는다 — 배송 단계 타임라인 기록으로만 진행된다.
  SHIPPED: [],
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

const CARRIER_OPTIONS = ['CJ대한통운', '한진택배', '로젠택배', '우체국택배', '기타'];

const DELIVERY_STAGE_ORDER: DeliveryStage[] = [
  'COLLECTED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

const DELIVERY_STAGE_LABEL: Record<DeliveryStage, string> = {
  COLLECTED: '집화완료',
  IN_TRANSIT: '간선상차',
  OUT_FOR_DELIVERY: '배송출발',
  DELIVERED: '배송완료',
};

interface Props {
  token: string;
  onAuthError: () => void;
}

export function AdminDashboardPage({ token, onAuthError }: Props) {
  const [stock, setStock] = useState<StockOverviewItem[]>([]);
  const [orders, setOrders] = useState<RecentOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [shippingForm, setShippingForm] = useState<{
    orderNumber: string;
    trackingNumber: string;
    carrier: string;
  } | null>(null);
  const [locationDraft, setLocationDraft] = useState<Record<string, string>>({});
  const [recordingStage, setRecordingStage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchStockOverview(), fetchRecentOrders()])
      .then(([stockOverview, recentOrders]) => {
        setStock(stockOverview);
        setOrders(recentOrders);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.statusCode === 401) {
          onAuthError();
        }
      })
      .finally(() => setLoading(false));
  }, [onAuthError]);

  useEffect(() => {
    const source = new EventSource(
      `${API_BASE_URL}/admin/events?token=${encodeURIComponent(token)}`,
    );

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
  }, [token]);

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

  async function handleConfirmShipping() {
    if (!shippingForm) return;
    const { orderNumber, trackingNumber, carrier } = shippingForm;
    setUpdating(orderNumber);
    try {
      await updateOrderStatus(orderNumber, 'SHIPPED', trackingNumber, carrier);
      setShippingForm(null);
      if (!connected) {
        setOrders((prev) =>
          prev.map((o) =>
            o.orderNumber === orderNumber
              ? { ...o, status: 'SHIPPED', trackingNumber, carrier }
              : o,
          ),
        );
      }
    } finally {
      setUpdating(null);
    }
  }

  async function handleRecordStage(orderNumber: string, stage: DeliveryStage) {
    setRecordingStage(orderNumber);
    try {
      const location = locationDraft[orderNumber]?.trim() || undefined;
      const updated = await addDeliveryEvent(orderNumber, stage, location);
      setLocationDraft((prev) => ({ ...prev, [orderNumber]: '' }));
      if (!connected) {
        setOrders((prev) =>
          prev.map((o) => (o.orderNumber === orderNumber ? updated : o)),
        );
      }
    } finally {
      setRecordingStage(null);
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
            const isShippingForm = shippingForm?.orderNumber === order.orderNumber;
            const nextStage =
              status === 'SHIPPED'
                ? DELIVERY_STAGE_ORDER[order.deliveryEvents.length]
                : undefined;
            const hasDeliveryInfo =
              Boolean(order.trackingNumber) || order.deliveryEvents.length > 0;

            return (
              <Fragment key={order.orderNumber}>
                <tr>
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
                    {isShippingForm ? (
                      <form
                        className="shipping-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleConfirmShipping();
                        }}
                      >
                        <input
                          className="shipping-form-input"
                          type="text"
                          required
                          placeholder="송장번호"
                          value={shippingForm.trackingNumber}
                          onChange={(e) =>
                            setShippingForm((prev) =>
                              prev
                                ? { ...prev, trackingNumber: e.target.value }
                                : prev,
                            )
                          }
                        />
                        <select
                          className="shipping-form-select"
                          value={shippingForm.carrier}
                          onChange={(e) =>
                            setShippingForm((prev) =>
                              prev ? { ...prev, carrier: e.target.value } : prev,
                            )
                          }
                        >
                          {CARRIER_OPTIONS.map((carrier) => (
                            <option key={carrier} value={carrier}>
                              {carrier}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="order-action-btn primary"
                          disabled={isUpdating}
                        >
                          {isUpdating ? '...' : '확인'}
                        </button>
                        <button
                          type="button"
                          className="order-action-btn"
                          onClick={() => setShippingForm(null)}
                        >
                          취소
                        </button>
                      </form>
                    ) : (
                      <div className="order-actions">
                        {actions.map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            className={`order-action-btn ${action.variant}`}
                            disabled={isUpdating}
                            onClick={() => {
                              if (action.requiresTracking) {
                                setShippingForm({
                                  orderNumber: order.orderNumber,
                                  trackingNumber: '',
                                  carrier: CARRIER_OPTIONS[0],
                                });
                              } else {
                                void handleStatusChange(
                                  order.orderNumber,
                                  action.status,
                                );
                              }
                            }}
                          >
                            {isUpdating ? '...' : action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
                {hasDeliveryInfo && (
                  <tr className="delivery-detail-row">
                    <td colSpan={6}>
                      <div className="delivery-panel">
                        {order.trackingNumber && (
                          <p className="delivery-tracking-info">
                            {order.carrier} · {order.trackingNumber}
                          </p>
                        )}
                        <ol className="delivery-timeline">
                          {DELIVERY_STAGE_ORDER.map((stage) => {
                            const event = order.deliveryEvents.find(
                              (e) => e.stage === stage,
                            );
                            return (
                              <li key={stage} className={event ? 'done' : ''}>
                                {DELIVERY_STAGE_LABEL[stage]}
                                {event && (
                                  <span className="delivery-event-meta">
                                    {event.location ? ` · ${event.location}` : ''} (
                                    {new Date(event.occurredAt).toLocaleString()})
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                        {nextStage && (
                          <div className="delivery-next-stage">
                            <input
                              className="delivery-location-input"
                              type="text"
                              placeholder="위치 (선택, 예: 서울 동부 터미널)"
                              value={locationDraft[order.orderNumber] ?? ''}
                              onChange={(e) =>
                                setLocationDraft((prev) => ({
                                  ...prev,
                                  [order.orderNumber]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="order-action-btn primary"
                              disabled={recordingStage === order.orderNumber}
                              onClick={() =>
                                void handleRecordStage(order.orderNumber, nextStage)
                              }
                            >
                              {recordingStage === order.orderNumber
                                ? '...'
                                : `${DELIVERY_STAGE_LABEL[nextStage]} 기록`}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
