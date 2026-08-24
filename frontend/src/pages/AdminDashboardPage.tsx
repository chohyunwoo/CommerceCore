import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ApiError } from '../api/client';
import { fetchStats } from '../api/admin';
import type { AdminStats } from '../api/types';

// 라이트 테마용 카테고리 팔레트(dataviz 스킬 검증본). 3색 도넛은 all-pairs 통과,
// 단일 측정(매출) 차트는 파랑 단색을 쓴다.
const ACCENT = '#2a78d6';
const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];

const STATUS_LABEL: Record<string, string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  SHIPPED: '배송 중',
  DELIVERED: '배송 완료',
  CANCELLED: '취소됨',
};

type RevenueMode = 'daily' | 'monthly';

function formatWon(value: number): string {
  return `${value.toLocaleString()}원`;
}

// 축 눈금은 길지 않게 축약(예: 12,000 → 1.2만).
function formatWonCompact(value: number): string {
  if (value >= 10000) {
    const man = value / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}만`;
  }
  return value.toLocaleString();
}

interface Props {
  onAuthError: () => void;
}

export function AdminDashboardPage({ onAuthError }: Props) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [revenueMode, setRevenueMode] = useState<RevenueMode>('daily');

  useEffect(() => {
    setLoading(true);
    fetchStats()
      .then(setStats)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.statusCode === 401) {
          onAuthError();
        }
      })
      .finally(() => setLoading(false));
  }, [onAuthError]);

  if (loading) {
    return (
      <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>
        통계를 불러오는 중...
      </p>
    );
  }

  if (!stats) {
    return (
      <p style={{ color: 'var(--text-sub)', fontSize: '13px' }}>
        통계를 불러오지 못했습니다.
      </p>
    );
  }

  const revenueSeries =
    revenueMode === 'daily'
      ? stats.revenueDaily.map((d) => ({ label: d.date.slice(5), revenue: d.revenue }))
      : stats.revenueMonthly.map((m) => ({ label: m.month, revenue: m.revenue }));

  const categoryData = stats.categoryRevenue.filter((c) => c.revenue > 0);
  const topProductsData = [...stats.topProducts].reverse(); // 가로 막대는 위→아래로 큰 값이 오게
  const statusData = stats.orderStatusDistribution.map((s) => ({
    label: STATUS_LABEL[s.status] ?? s.status,
    count: s.count,
  }));

  return (
    <section id="admin-dashboard">
      <p className="admin-section-title">대시보드</p>

      <div className="kpi-row">
        <div className="kpi-tile">
          <span className="kpi-label">총 매출</span>
          <span className="kpi-value">
            {stats.summary.totalRevenue.toLocaleString()}
            <span className="kpi-unit">원</span>
          </span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">총 판매량</span>
          <span className="kpi-value">
            {stats.summary.totalUnits.toLocaleString()}
            <span className="kpi-unit">개</span>
          </span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">총 주문</span>
          <span className="kpi-value">
            {stats.summary.totalOrders.toLocaleString()}
            <span className="kpi-unit">건</span>
          </span>
        </div>
      </div>
      <p className="chart-caption">
        매출 지표는 결제 완료·배송 중·배송 완료 주문만 집계합니다.
      </p>

      <div className="chart-card">
        <div className="chart-card-head">
          <p className="chart-title">매출 추이</p>
          <div className="chart-toggle">
            <button
              type="button"
              className={revenueMode === 'daily' ? 'active' : ''}
              onClick={() => setRevenueMode('daily')}
            >
              일별
            </button>
            <button
              type="button"
              className={revenueMode === 'monthly' ? 'active' : ''}
              onClick={() => setRevenueMode('monthly')}
            >
              월별
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={revenueSeries}
            margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
          >
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-sub)' }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-sub)' }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={formatWonCompact}
            />
            <Tooltip
              formatter={(value) => [formatWon(Number(value)), '매출']}
              labelStyle={{ color: 'var(--text)' }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={ACCENT}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <p className="chart-title">카테고리별 매출 비중</p>
          {categoryData.length === 0 ? (
            <p className="chart-empty">매출 데이터가 없습니다.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="revenue"
                  nameKey="categoryName"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {categoryData.map((entry, i) => (
                    <Cell
                      key={entry.categoryName}
                      fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatWon(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <p className="chart-title">인기 상품 Top 5 (매출)</p>
          {topProductsData.length === 0 ? (
            <p className="chart-empty">판매 데이터가 없습니다.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={topProductsData}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
              >
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--text-sub)' }}
                  tickLine={false}
                  tickFormatter={formatWonCompact}
                />
                <YAxis
                  type="category"
                  dataKey="productName"
                  tick={{ fontSize: 11, fill: 'var(--text-sub)' }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip
                  formatter={(value) => [formatWon(Number(value)), '매출']}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Bar dataKey="revenue" fill={ACCENT} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <p className="chart-title">주문 상태 분포</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={statusData}
              layout="vertical"
              margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
            >
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--text-sub)' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-sub)' }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                formatter={(value) => [`${Number(value)}건`, '주문']}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              <Bar dataKey="count" fill={ACCENT} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
