import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL, ApiError } from '../api/client';
import { fetchStockOverview, issueSseTicket } from '../api/admin';
import type { StockOverviewItem } from '../api/types';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminOrdersPage } from './AdminOrdersPage';
import { AdminInventoryPage } from './AdminInventoryPage';
import type { StockStatusFilter } from './AdminInventoryPage';
import { AdminMembersPage } from './AdminMembersPage';
import { AdminProductsPage } from './AdminProductsPage';
import { LOW_STOCK_THRESHOLD } from './adminConstants';
import { useAuth } from '../context/AuthContext';

const SSE_RECONNECT_DELAY_MS = 3000;

type AdminSection =
  | 'dashboard'
  | 'orders'
  | 'inventory'
  | 'members'
  | 'products';

const NAV_ITEMS: { section: AdminSection; label: string }[] = [
  { section: 'dashboard', label: '대시보드' },
  { section: 'orders', label: '주문 관리' },
  { section: 'inventory', label: '재고 관리' },
  { section: 'members', label: '회원·구매자' },
  { section: 'products', label: '상품 관리' },
];

export function AdminPage() {
  const { user, loading, logout } = useAuth();

  // 세션이 만료되거나 권한이 회수된 채로 관리자 API를 호출하면 401이 돌아온다 —
  // 그 경우 세션을 정리하고 재로그인을 안내한다(정적 토큰 재입력 방식이 아님).
  function handleAuthError() {
    void logout();
  }

  if (loading) {
    return (
      <section id="admin-login">
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>불러오는 중...</p>
      </section>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <section id="admin-login">
        <div className="admin-login-box">
          <h1 className="admin-login-title">관리자 전용 페이지입니다</h1>
          <p className="admin-login-error">
            {user
              ? '이 계정은 관리자 권한이 없습니다.'
              : '관리자 계정으로 로그인해야 접근할 수 있습니다.'}
          </p>
          {!user && (
            <Link
              to="/login"
              className="admin-login-btn"
              style={{ display: 'inline-block' }}
            >
              로그인하러 가기
            </Link>
          )}
        </div>
      </section>
    );
  }

  // 관리자 확인 후에만 실시간 연결/상태 훅이 도는 shell을 렌더한다.
  return <AdminShell onAuthError={handleAuthError} />;
}

interface ShellProps {
  onAuthError: () => void;
}

function AdminShell({ onAuthError }: ShellProps) {
  const [section, setSection] = useState<AdminSection>('orders');
  const [stock, setStock] = useState<StockOverviewItem[]>([]);
  const [connected, setConnected] = useState(false);
  // SSE order-update 수신 시마다 증가 — 주문 화면이 이 값을 구독해 재조회한다.
  const [orderUpdateNonce, setOrderUpdateNonce] = useState(0);
  // 재고 부족 배너 클릭 시 재고 화면에 전달할 상태 필터 요청(nonce로 매번 재적용).
  const [stockFilterReq, setStockFilterReq] = useState<{
    value: StockStatusFilter;
    nonce: number;
  }>({ value: 'all', nonce: 0 });

  // 재고는 배너(전 화면 상단)와 재고 관리 화면이 공유하므로 shell에서 관리한다.
  useEffect(() => {
    fetchStockOverview()
      .then(setStock)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.statusCode === 401) {
          onAuthError();
        }
      });
  }, [onAuthError]);

  // EventSource가 커스텀 헤더를 못 보내 세션 토큰을 URL에 그대로 실을 수 없다 —
  // 매 연결 시도마다 1회용 단기 티켓(TTL 30초)을 새로 발급받아 ?ticket=으로
  // 전달한다(결정 38). 네이티브 자동 재연결은 이미 소모된 티켓을 재사용해 실패하므로
  // 직접 close 후 새 티켓으로 재연결한다. 연결 1개로 stock-update/order-update를 모두 받는다.
  useEffect(() => {
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function connect() {
      try {
        const { ticket } = await issueSseTicket();
        if (cancelled) return;

        source = new EventSource(
          `${API_BASE_URL}/admin/events?ticket=${encodeURIComponent(ticket)}`,
        );

        source.onopen = () => setConnected(true);
        source.onerror = () => {
          setConnected(false);
          source?.close();
          if (!cancelled) {
            reconnectTimer = setTimeout(
              () => void connect(),
              SSE_RECONNECT_DELAY_MS,
            );
          }
        };

        source.addEventListener('stock-update', (event) => {
          const update = JSON.parse(event.data) as StockOverviewItem;
          setStock((prev) => {
            const exists = prev.some(
              (item) => item.productOptionId === update.productOptionId,
            );
            if (!exists) return [...prev, update];
            return prev.map((item) =>
              item.productOptionId === update.productOptionId
                ? { ...item, ...update }
                : item,
            );
          });
        });

        source.addEventListener('order-update', () => {
          setOrderUpdateNonce((n) => n + 1);
        });
      } catch (err: unknown) {
        if (err instanceof ApiError && err.statusCode === 401) {
          onAuthError();
          return;
        }
        if (!cancelled) {
          reconnectTimer = setTimeout(() => void connect(), SSE_RECONNECT_DELAY_MS);
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [onAuthError]);

  const outOfStockCount = stock.filter((item) => item.stock === 0).length;
  const lowStockCount = stock.filter(
    (item) => item.stock > 0 && item.stock <= LOW_STOCK_THRESHOLD,
  ).length;
  const showStockAlert = outOfStockCount > 0 || lowStockCount > 0;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <p className="admin-sidebar-title">Admin</p>
        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.section}
              type="button"
              className={section === item.section ? 'active' : ''}
              onClick={() => setSection(item.section)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-status">
          <span className={`sse-dot${connected ? ' live' : ''}`} />
          {connected ? '실시간 연동 중' : '연결 끊김'}
        </div>
      </aside>

      <div className="admin-content">
        {showStockAlert && (
          <button
            type="button"
            className="stock-alert-banner"
            onClick={() => {
              setSection('inventory');
              // "확인이 필요한 재고"(품절 포함 임계값 이하)만 보이도록 필터 요청.
              setStockFilterReq((r) => ({ value: 'low', nonce: r.nonce + 1 }));
            }}
          >
            <span className="stock-alert-icon">!</span>
            <span>
              재고 확인 필요 —
              {outOfStockCount > 0 && ` 품절 ${outOfStockCount}건`}
              {outOfStockCount > 0 && lowStockCount > 0 && ','}
              {lowStockCount > 0 &&
                ` 재고 부족(${LOW_STOCK_THRESHOLD}개 이하) ${lowStockCount}건`}
            </span>
            <span className="stock-alert-cta">재고 관리로 이동 →</span>
          </button>
        )}

        {section === 'dashboard' && (
          <AdminDashboardPage onAuthError={onAuthError} />
        )}
        {section === 'orders' && (
          <AdminOrdersPage
            orderUpdateNonce={orderUpdateNonce}
            connected={connected}
            onAuthError={onAuthError}
          />
        )}
        {section === 'inventory' && (
          <AdminInventoryPage
            stock={stock}
            statusFilterRequest={stockFilterReq}
            onAuthError={onAuthError}
          />
        )}
        {section === 'members' && (
          <AdminMembersPage onAuthError={onAuthError} />
        )}
        {section === 'products' && (
          <AdminProductsPage onAuthError={onAuthError} />
        )}
      </div>
    </div>
  );
}
