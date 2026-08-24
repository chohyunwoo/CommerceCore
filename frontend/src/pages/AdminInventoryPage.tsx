import { useState } from 'react';
import type { StockOverviewItem } from '../api/types';
import { LOW_STOCK_THRESHOLD } from './adminConstants';

interface Props {
  stock: StockOverviewItem[];
}

export function AdminInventoryPage({ stock }: Props) {
  const [stockCategoryFilter, setStockCategoryFilter] = useState('');

  // 백엔드가 이미 카테고리 순으로 정렬해서 내려주므로, 등장 순서 그대로 탭 목록을 뽑는다.
  const stockCategories = Array.from(
    new Set(stock.map((item) => item.categoryName)),
  );
  const visibleStock = stockCategoryFilter
    ? stock.filter((item) => item.categoryName === stockCategoryFilter)
    : stock;

  const stockByCategory: { categoryName: string; items: StockOverviewItem[] }[] =
    [];
  for (const item of visibleStock) {
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
    </>
  );
}
