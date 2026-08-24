import { useEffect, useState } from 'react';
import type { StockOverviewItem } from '../api/types';
import { LOW_STOCK_THRESHOLD } from './adminConstants';

const STOCK_PAGE_SIZE = 20;

// 재고 상태 필터. 'low'는 임계값 이하(품절 포함)로 "확인이 필요한 재고" 전체를 뜻한다.
export type StockStatusFilter = 'all' | 'low' | 'out';

const STATUS_TABS: { label: string; value: StockStatusFilter }[] = [
  { label: '전체', value: 'all' },
  { label: `재고 부족(${LOW_STOCK_THRESHOLD}개 이하)`, value: 'low' },
  { label: '품절', value: 'out' },
];

interface Props {
  stock: StockOverviewItem[];
  // 배너에서 넘어올 때 적용할 상태 필터 요청. nonce가 바뀔 때마다 value로 재설정한다.
  statusFilterRequest?: { value: StockStatusFilter; nonce: number };
}

export function AdminInventoryPage({ stock, statusFilterRequest }: Props) {
  const [stockCategoryFilter, setStockCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('all');
  const [page, setPage] = useState(1);

  // 카테고리/상태 필터가 바뀌면 항상 첫 페이지부터 다시 본다.
  useEffect(() => {
    setPage(1);
  }, [stockCategoryFilter, statusFilter]);

  // 재고 부족 배너 클릭 등 외부 요청이 오면 상태 필터를 그 값으로 맞춘다.
  useEffect(() => {
    if (statusFilterRequest) {
      setStatusFilter(statusFilterRequest.value);
      setStockCategoryFilter('');
    }
  }, [statusFilterRequest]);

  // 백엔드가 이미 카테고리 순으로 정렬해서 내려주므로, 등장 순서 그대로 탭 목록을 뽑는다.
  const stockCategories = Array.from(
    new Set(stock.map((item) => item.categoryName)),
  );
  const matchesStatus = (item: StockOverviewItem): boolean => {
    if (statusFilter === 'low') return item.stock <= LOW_STOCK_THRESHOLD;
    if (statusFilter === 'out') return item.stock === 0;
    return true;
  };
  const visibleStock = stock.filter(
    (item) =>
      (!stockCategoryFilter || item.categoryName === stockCategoryFilter) &&
      matchesStatus(item),
  );

  // 클라이언트 사이드 페이지네이션 — shell(AdminPage)이 전체 stock을 들고 있어(배너·SSE
  // 실시간 갱신 유지) 여기서는 화면에 보일 만큼만 잘라 표시한다. 재고가 SSE로 줄어 총 개수가
  // 바뀌어도 현재 페이지가 범위를 벗어나지 않도록 보정한다.
  const totalPages = Math.max(1, Math.ceil(visibleStock.length / STOCK_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * STOCK_PAGE_SIZE;
  const pageItems = visibleStock.slice(pageStart, pageStart + STOCK_PAGE_SIZE);

  // 카테고리 그룹 헤더는 "현재 페이지에 실제로 보이는 항목" 기준으로만 다시 묶는다.
  const stockByCategory: { categoryName: string; items: StockOverviewItem[] }[] =
    [];
  for (const item of pageItems) {
    const lastGroup = stockByCategory[stockByCategory.length - 1];
    if (lastGroup && lastGroup.categoryName === item.categoryName) {
      lastGroup.items.push(item);
    } else {
      stockByCategory.push({ categoryName: item.categoryName, items: [item] });
    }
  }

  return (
    <>
      <p className="admin-section-title">재고 현황</p>
      <div className="category-filter">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={statusFilter === tab.value ? 'active' : ''}
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="category-filter">
        <button
          type="button"
          className={stockCategoryFilter === '' ? 'active' : ''}
          onClick={() => setStockCategoryFilter('')}
        >
          전체
        </button>
        {stockCategories.map((categoryName) => (
          <button
            key={categoryName}
            type="button"
            className={stockCategoryFilter === categoryName ? 'active' : ''}
            onClick={() => setStockCategoryFilter(categoryName)}
          >
            {categoryName}
          </button>
        ))}
      </div>
      {visibleStock.length === 0 && (
        <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>
          조건에 맞는 재고가 없습니다.
        </p>
      )}
      {stockByCategory.map((group) => (
        <div key={group.categoryName} className="stock-category-group">
          <p className="stock-category-title">{group.categoryName}</p>
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
              {group.items.map((item) => {
                const isLow = item.stock > 0 && item.stock <= LOW_STOCK_THRESHOLD;
                return (
                  <tr key={item.productOptionId}>
                    <td>{item.productName}</td>
                    <td>{item.size}</td>
                    <td>{item.color}</td>
                    <td
                      className={
                        item.stock === 0
                          ? 'stock-zero'
                          : isLow
                            ? 'stock-low'
                            : ''
                      }
                    >
                      {item.stock > 0 ? item.stock : '품절'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
          >
            이전
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            className="pagination-btn"
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
          >
            다음
          </button>
        </div>
      )}
    </>
  );
}
