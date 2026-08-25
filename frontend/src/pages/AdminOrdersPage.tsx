import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import {
  addDeliveryEvent,
  fetchRecentOrders,
  updateOrderStatus,
} from '../api/admin';
import type { RecentOrderItem } from '../api/types';

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

// 결제 미완료(PENDING)는 관리자 처리 대상이 아니라 목록/탭에서 제외한다(결정 44).
// '전체'도 백엔드에서 PENDING을 제외한 결과를 반환한다.
const ORDER_STATUS_TABS: { label: string; status: OrderStatus | '' }[] = [
  { label: '전체', status: '' },
  { label: STATUS_LABEL.PAID, status: 'PAID' },
  { label: STATUS_LABEL.SHIPPED, status: 'SHIPPED' },
  { label: STATUS_LABEL.DELIVERED, status: 'DELIVERED' },
  { label: STATUS_LABEL.CANCELLED, status: 'CANCELLED' },
];

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
  // shell(AdminPage)이 SSE order-update를 받을 때마다 증가시키는 값 — 변할 때 재조회한다.
  orderUpdateNonce: number;
  // SSE 연결 여부. 연결돼 있으면 액션 후 자동 반영되므로 수동 재조회를 생략한다.
  connected: boolean;
  onAuthError: () => void;
}

export function AdminOrdersPage({
  orderUpdateNonce,
  connected,
  onAuthError,
}: Props) {
  const [orders, setOrders] = useState<RecentOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [shippingForm, setShippingForm] = useState<{
    orderNumber: string;
    trackingNumber: string;
    carrier: string;
  } | null>(null);
  const [locationDraft, setLocationDraft] = useState<Record<string, string>>({});
  const [recordingStage, setRecordingStage] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | ''>('');
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotalPages, setOrderTotalPages] = useState(1);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const loadOrders = useCallback(() => {
    return fetchRecentOrders(
      orderStatusFilter || undefined,
      orderPage,
      RECENT_ORDERS_LIMIT,
      buyerSearch || undefined,
    ).then(({ items, totalPages }) => {
      setOrders(items);
      setOrderTotalPages(totalPages);
    });
  }, [orderStatusFilter, orderPage, buyerSearch]);

  // 필터/페이지/검색 변경 시 재조회 (최초 로드 포함)
  useEffect(() => {
    setLoading(true);
    loadOrders()
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.statusCode === 401) {
          onAuthError();
        }
      })
      .finally(() => setLoading(false));
  }, [loadOrders, onAuthError]);

  // SSE order-update 수신 시 현재 필터/페이지 기준으로 재조회. 최초 마운트 시엔 위 effect가
  // 이미 로드하므로 중복 호출을 피한다.
  const loadOrdersRef = useRef(loadOrders);
  useEffect(() => {
    loadOrdersRef.current = loadOrders;
  }, [loadOrders]);
  const isFirstNonce = useRef(true);
  useEffect(() => {
    if (isFirstNonce.current) {
      isFirstNonce.current = false;
      return;
    }
    void loadOrdersRef.current();
  }, [orderUpdateNonce]);

  function handleStatusFilterChange(status: OrderStatus | '') {
    setOrderStatusFilter(status);
    setOrderPage(1);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBuyerSearch(searchInput.trim());
    setOrderPage(1);
  }

  async function handleStatusChange(orderNumber: string, status: OrderStatus) {
    setUpdating(orderNumber);
    try {
      await updateOrderStatus(orderNumber, status);
      // SSE가 연결돼 있으면 자동 반영, 연결 안 됐으면 현재 필터/페이지 기준으로 재조회
      if (!connected) {
        void loadOrders();
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
        void loadOrders();
      }
    } finally {
      setUpdating(null);
    }
  }

  async function handleRecordStage(orderNumber: string, stage: DeliveryStage) {
    setRecordingStage(orderNumber);
    try {
      const location = locationDraft[orderNumber]?.trim() || undefined;
      await addDeliveryEvent(orderNumber, stage, location);
      setLocationDraft((prev) => ({ ...prev, [orderNumber]: '' }));
      if (!connected) {
        void loadOrders();
      }
    } finally {
      setRecordingStage(null);
    }
  }

  return (
    <>
      <p className="admin-section-title">최근 주문</p>
      <div className="category-filter">
        {ORDER_STATUS_TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            className={orderStatusFilter === tab.status ? 'active' : ''}
            onClick={() => handleStatusFilterChange(tab.status)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <form className="admin-search-form" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          className="admin-search-input"
          placeholder="구매자 이름 또는 이메일 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="order-action-btn primary">
          검색
        </button>
        {buyerSearch && (
          <button
            type="button"
            className="order-action-btn"
            onClick={() => {
              setSearchInput('');
              setBuyerSearch('');
              setOrderPage(1);
            }}
          >
            초기화
          </button>
        )}
      </form>
      {loading ? (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>불러오는 중...</p>
      ) : (
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
              const isShippingForm =
                shippingForm?.orderNumber === order.orderNumber;
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
                      <span
                        className={`order-status-badge status-${status.toLowerCase()}`}
                      >
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
                                      {event.location ? ` · ${event.location}` : ''}{' '}
                                      ({new Date(event.occurredAt).toLocaleString()})
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
      )}

      {orderTotalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => setOrderPage((p) => p - 1)}
            disabled={orderPage === 1}
          >
            이전
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
            {orderPage} / {orderTotalPages}
          </span>
          <button
            type="button"
            className="pagination-btn"
            onClick={() => setOrderPage((p) => p + 1)}
            disabled={orderPage === orderTotalPages}
          >
            다음
          </button>
        </div>
      )}
    </>
  );
}
