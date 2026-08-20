import type { OrderLookupResult } from '../api/types';

const DELIVERY_STAGE_ORDER = [
  'COLLECTED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

const DELIVERY_STAGE_LABEL: Record<string, string> = {
  COLLECTED: '집화완료',
  IN_TRANSIT: '간선상차',
  OUT_FOR_DELIVERY: '배송출발',
  DELIVERED: '배송완료',
};

interface Props {
  order: OrderLookupResult;
}

/** 게스트 주문조회 결과와 마이페이지 주문 상세가 공유하는 렌더링. */
export function OrderDetailView({ order }: Props) {
  return (
    <div className="order-lookup-result">
      <p className="lookup-order-num">주문번호 {order.orderNumber}</p>
      <p className="lookup-status">{order.status}</p>

      <div className="lookup-info">
        <p>구매자: {order.buyerName} ({order.buyerEmail})</p>
        <p>연락처: {order.buyerPhone}</p>
        <p>
          배송지:{' '}
          {order.postalCode
            ? `[${order.postalCode}] ${order.baseAddress ?? ''} ${order.detailAddress ?? ''}`.trim()
            : order.buyerAddress}
        </p>
        {order.trackingNumber && (
          <p>
            송장: {order.carrier} {order.trackingNumber}
          </p>
        )}
      </div>

      {order.deliveryEvents.length > 0 && (
        <ol className="delivery-timeline" style={{ marginBottom: '16px' }}>
          {DELIVERY_STAGE_ORDER.map((stage) => {
            const event = order.deliveryEvents.find((e) => e.stage === stage);
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
      )}

      <ul className="form-summary">
        {order.items.map((item, index) => (
          <li key={index}>
            {item.productName} ({item.size} / {item.color}) × {item.quantity} —{' '}
            {item.lineTotal.toLocaleString()}원
          </li>
        ))}
      </ul>

      <p style={{ textAlign: 'right', fontSize: '16px', paddingTop: '16px' }}>
        합계: {order.totalAmount.toLocaleString()}원
      </p>
    </div>
  );
}
