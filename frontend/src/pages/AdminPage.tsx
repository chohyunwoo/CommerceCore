import { useState } from 'react';
import { AdminDashboardPage } from './AdminDashboardPage';

export function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') ?? '');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    localStorage.setItem('adminToken', input.trim());
    setToken(input.trim());
    setInput('');
    setError(null);
  }

  function handleAuthError() {
    localStorage.removeItem('adminToken');
    setToken('');
    setError('인증에 실패했습니다. 토큰을 다시 입력해 주세요.');
  }

  if (!token) {
    return (
      <section id="admin-login">
        <div className="admin-login-box">
          <h1 className="admin-login-title">관리자 로그인</h1>
          {error && <p className="admin-login-error">{error}</p>}
          <form className="admin-login-form" onSubmit={handleLogin}>
            <input
              type="password"
              className="admin-login-input"
              placeholder="관리자 토큰"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="admin-login-btn">
              확인
            </button>
          </form>
        </div>
      </section>
    );
  }

  return <AdminDashboardPage token={token} onAuthError={handleAuthError} />;
}
