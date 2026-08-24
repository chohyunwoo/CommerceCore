// 통계 대시보드(매출 추이/판매량/카테고리별 비중/인기 상품 Top N/주문 상태 분포)는
// 개편 2단계에서 Recharts + 백엔드 집계 API로 구현한다. 1단계에서는 사이드바 항목만
// 자리를 잡아두는 플레이스홀더.
export function AdminDashboardPage() {
  return (
    <div className="admin-placeholder">
      <p className="admin-section-title">대시보드</p>
      <p className="admin-placeholder-text">
        매출·판매량 통계 대시보드는 준비 중입니다.
      </p>
    </div>
  );
}
