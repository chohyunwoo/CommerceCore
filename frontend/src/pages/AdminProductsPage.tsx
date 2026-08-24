import { Fragment, useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  addProductOption,
  fetchAdminProducts,
  softDeleteProduct,
  updateOptionStock,
} from '../api/admin';
import type { AdminProductItem } from '../api/types';
import { AdminProductForm } from './AdminProductForm';

const PAGE_SIZE = 20;

type NewOptionDraft = { size: string; color: string; stock: string; sku: string };

const EMPTY_OPTION: NewOptionDraft = { size: '', color: '', stock: '', sku: '' };

interface Props {
  onAuthError: () => void;
}

export function AdminProductsPage({ onAuthError }: Props) {
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 옵션별 재고 입력 임시값(productOptionId -> 값)
  const [stockDraft, setStockDraft] = useState<Record<number, string>>({});
  // 상품별 새 옵션 입력값(productId -> draft)
  const [newOption, setNewOption] = useState<Record<number, NewOptionDraft>>({});

  const load = useCallback(() => {
    return fetchAdminProducts(page, PAGE_SIZE, search || undefined).then(
      (res) => {
        setProducts(res.items);
        setTotalPages(res.totalPages);
      },
    );
  }, [page, search]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.statusCode === 401) onAuthError();
      })
      .finally(() => setLoading(false));
  }, [load, onAuthError]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function withError(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    fn()
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.statusCode === 401) {
          onAuthError();
          return;
        }
        setError(err instanceof ApiError ? err.message : '작업에 실패했습니다.');
      })
      .finally(() => setBusy(false));
  }

  function handleDelete(product: AdminProductItem) {
    if (
      !window.confirm(
        `'${product.name}' 상품을 삭제할까요?\n(주문 이력은 보존되며, 고객 화면·재고에서 숨겨집니다)`,
      )
    ) {
      return;
    }
    withError(async () => {
      await softDeleteProduct(product.id);
      await load();
    });
  }

  function handleRestock(productId: number, optionId: number) {
    const raw = stockDraft[optionId];
    const value = Number(raw);
    if (raw === undefined || raw === '' || !Number.isInteger(value) || value < 0) {
      setError('재고는 0 이상의 정수여야 합니다.');
      return;
    }
    withError(async () => {
      await updateOptionStock(productId, optionId, value);
      setStockDraft((prev) => {
        const next = { ...prev };
        delete next[optionId];
        return next;
      });
      await load();
    });
  }

  function handleAddOption(productId: number) {
    const draft = newOption[productId] ?? EMPTY_OPTION;
    const stock = Number(draft.stock);
    if (
      !draft.size.trim() ||
      !draft.color.trim() ||
      !draft.sku.trim() ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setError('옵션의 사이즈/색상/SKU와 0 이상 정수 재고를 입력하세요.');
      return;
    }
    withError(async () => {
      await addProductOption(productId, {
        size: draft.size.trim(),
        color: draft.color.trim(),
        stock,
        sku: draft.sku.trim(),
      });
      setNewOption((prev) => ({ ...prev, [productId]: { ...EMPTY_OPTION } }));
      await load();
    });
  }

  return (
    <section id="admin-products">
      <p className="admin-section-title">상품 목록</p>

      <form className="admin-search-form" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          className="admin-search-input"
          placeholder="상품명 검색"
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

      {error && <p className="admin-login-error">{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>
          불러오는 중...
        </p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>상품</th>
              <th>카테고리</th>
              <th>가격</th>
              <th>총재고</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-sub)' }}>
                  상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const isOpen = expanded === product.id;
                const draft = newOption[product.id] ?? EMPTY_OPTION;
                return (
                  <Fragment key={product.id}>
                    <tr>
                      <td>{product.name}</td>
                      <td>{product.categoryName}</td>
                      <td>{product.basePrice.toLocaleString()}원</td>
                      <td>{product.totalStock.toLocaleString()}</td>
                      <td>
                        <div className="order-actions">
                          <button
                            type="button"
                            className="order-action-btn"
                            onClick={() =>
                              setExpanded(isOpen ? null : product.id)
                            }
                          >
                            {isOpen ? '옵션 닫기' : '옵션 관리'}
                          </button>
                          <button
                            type="button"
                            className="order-action-btn danger"
                            disabled={busy}
                            onClick={() => handleDelete(product)}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="delivery-detail-row">
                        <td colSpan={5}>
                          <div className="delivery-panel">
                            <table className="admin-table" style={{ marginBottom: 16 }}>
                              <thead>
                                <tr>
                                  <th>사이즈</th>
                                  <th>색상</th>
                                  <th>SKU</th>
                                  <th>재고</th>
                                  <th>재입고</th>
                                </tr>
                              </thead>
                              <tbody>
                                {product.options.map((opt) => (
                                  <tr key={opt.id}>
                                    <td>{opt.size}</td>
                                    <td>{opt.color}</td>
                                    <td>{opt.sku}</td>
                                    <td>{opt.stock}</td>
                                    <td>
                                      <div className="order-actions">
                                        <input
                                          className="shipping-form-input"
                                          type="number"
                                          min={0}
                                          placeholder={String(opt.stock)}
                                          value={stockDraft[opt.id] ?? ''}
                                          onChange={(e) =>
                                            setStockDraft((prev) => ({
                                              ...prev,
                                              [opt.id]: e.target.value,
                                            }))
                                          }
                                        />
                                        <button
                                          type="button"
                                          className="order-action-btn primary"
                                          disabled={busy}
                                          onClick={() =>
                                            handleRestock(product.id, opt.id)
                                          }
                                        >
                                          저장
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <p className="stock-category-title">옵션 추가</p>
                            <div className="order-actions">
                              <input
                                className="shipping-form-input"
                                placeholder="사이즈"
                                value={draft.size}
                                onChange={(e) =>
                                  setNewOption((prev) => ({
                                    ...prev,
                                    [product.id]: { ...draft, size: e.target.value },
                                  }))
                                }
                              />
                              <input
                                className="shipping-form-input"
                                placeholder="색상"
                                value={draft.color}
                                onChange={(e) =>
                                  setNewOption((prev) => ({
                                    ...prev,
                                    [product.id]: {
                                      ...draft,
                                      color: e.target.value,
                                    },
                                  }))
                                }
                              />
                              <input
                                className="shipping-form-input"
                                placeholder="SKU"
                                value={draft.sku}
                                onChange={(e) =>
                                  setNewOption((prev) => ({
                                    ...prev,
                                    [product.id]: { ...draft, sku: e.target.value },
                                  }))
                                }
                              />
                              <input
                                className="shipping-form-input"
                                type="number"
                                min={0}
                                placeholder="재고"
                                value={draft.stock}
                                onChange={(e) =>
                                  setNewOption((prev) => ({
                                    ...prev,
                                    [product.id]: {
                                      ...draft,
                                      stock: e.target.value,
                                    },
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="order-action-btn primary"
                                disabled={busy}
                                onClick={() => handleAddOption(product.id)}
                              >
                                추가
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
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

      <div style={{ marginTop: 48 }}>
        <p className="admin-section-title">신규 상품 등록</p>
        <AdminProductForm onAuthError={onAuthError} onCreated={() => void load()} />
      </div>
    </section>
  );
}
