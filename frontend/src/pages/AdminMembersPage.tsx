import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { fetchBuyers, fetchMembers } from '../api/admin';
import type { BuyerItem, MemberItem } from '../api/types';

const PAGE_SIZE = 20;

type SubTab = 'members' | 'buyers';

interface Props {
  onAuthError: () => void;
}

export function AdminMembersPage({ onAuthError }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('members');
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [buyers, setBuyers] = useState<BuyerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = useCallback(() => {
    if (subTab === 'members') {
      return fetchMembers(page, PAGE_SIZE, search || undefined).then((res) => {
        setMembers(res.items);
        setTotalPages(res.totalPages);
      });
    }
    return fetchBuyers(page, PAGE_SIZE, search || undefined).then((res) => {
      setBuyers(res.items);
      setTotalPages(res.totalPages);
    });
  }, [subTab, page, search]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.statusCode === 401) {
          onAuthError();
        }
      })
      .finally(() => setLoading(false));
  }, [load, onAuthError]);

  function switchTab(tab: SubTab) {
    if (tab === subTab) return;
    setSubTab(tab);
    setPage(1);
    setSearch('');
    setSearchInput('');
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <section id="admin-members">
      <p className="admin-section-title">회원·구매자</p>

      <div className="category-filter">
        <button
          type="button"
          className={subTab === 'members' ? 'active' : ''}
          onClick={() => switchTab('members')}
        >
          회원
        </button>
        <button
          type="button"
          className={subTab === 'buyers' ? 'active' : ''}
          onClick={() => switchTab('buyers')}
        >
          구매자
        </button>
      </div>

      <form className="admin-search-form" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          className="admin-search-input"
          placeholder="이름 또는 이메일 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="order-action-btn primary">
          검색
        </button>
        {search && (
          <button
            type="button"
            className="order-action-btn"
            onClick={() => {
              setSearchInput('');
              setSearch('');
              setPage(1);
            }}
          >
            초기화
          </button>
        )}
      </form>

      {loading ? (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>
          불러오는 중...
        </p>
      ) : subTab === 'members' ? (
        <table className="admin-table">
          <thead>
            <tr>
              <th>이메일</th>
              <th>이름</th>
              <th>역할</th>
              <th>가입일</th>
              <th>주문 수</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-sub)' }}>
                  결과가 없습니다.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id}>
                  <td>{m.email}</td>
                  <td>{m.name}</td>
                  <td>
                    {m.role === 'admin' ? (
                      <span className="role-badge role-admin">관리자</span>
                    ) : (
                      <span className="role-badge">회원</span>
                    )}
                  </td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td>{m.orderCount.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>이메일</th>
              <th>이름</th>
              <th>주문 수</th>
              <th>총 구매액</th>
              <th>최근 주문일</th>
            </tr>
          </thead>
          <tbody>
            {buyers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-sub)' }}>
                  결과가 없습니다.
                </td>
              </tr>
            ) : (
              buyers.map((b) => (
                <tr key={b.email}>
                  <td>{b.email}</td>
                  <td>{b.name}</td>
                  <td>{b.orderCount.toLocaleString()}</td>
                  <td>{b.totalSpent.toLocaleString()}원</td>
                  <td>{new Date(b.lastOrderedAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            다음
          </button>
        </div>
      )}
    </section>
  );
}
