import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminProductForm } from './AdminProductForm';
import { useAuth } from '../context/AuthContext';

type AdminTab = 'dashboard' | 'products';

export function AdminPage() {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState<AdminTab>('dashboard');

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
            <Link to="/login" className="admin-login-btn" style={{ display: 'inline-block' }}>
              로그인하러 가기
            </Link>
          )}
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="admin-tabs">
        <button
          type="button"
          className={tab === 'dashboard' ? 'active' : ''}
          onClick={() => setTab('dashboard')}
        >
          대시보드
        </button>
        <button
          type="button"
          className={tab === 'products' ? 'active' : ''}
          onClick={() => setTab('products')}
        >
          상품 등록
        </button>
      </div>
      {tab === 'dashboard' ? (
        <AdminDashboardPage onAuthError={handleAuthError} />
      ) : (
        <AdminProductForm onAuthError={handleAuthError} />
      )}
    </div>
  );
}
