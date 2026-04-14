import MetricCard from "../components/MetricCard";
import { formatCurrency } from "../lib/formatters";

export default function DashboardView({ stats, insights }) {
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weekdaySource = insights?.weekday_revenue || [];
  const dayRevenueMap = new Map(
    weekdaySource.map((item) => [String(item.label || "").toLowerCase(), Number(item.value || 0)])
  );
  const weekdayData = dayOrder.map((day) => ({
    label: day,
    shortLabel: day.slice(0, 3),
    value: dayRevenueMap.get(day.toLowerCase()) || 0,
  }));
  const maxWeekdayRevenue = Math.max(...weekdayData.map((point) => point.value), 1);
  const topSellers = insights?.top_sellers || [];

  return (
    <section className="view">
      <header className="view-header">
        <h2>Dashboard</h2>
        <p className="muted">Real-time operational overview and POS statistics.</p>
      </header>

      <section className="metrics-grid">
        <MetricCard label="Products" value={stats?.total_products ?? 0} />
        <MetricCard label="Low Stock" value={stats?.low_stock_count ?? 0} tone="warning" />
        <MetricCard label="Today Sales" value={stats?.today_sales ?? 0} />
        <MetricCard label="Today Revenue" value={formatCurrency(stats?.today_revenue)} tone="success" />
        <MetricCard label="Month Revenue" value={formatCurrency(stats?.this_month_revenue)} />
        <MetricCard label="Total Revenue" value={formatCurrency(stats?.gross_revenue)} tone="success" />
      </section>

      <article className="panel">
        <h3>POS Statistics</h3>
        <div className="pos-stats-grid">
          <section>
            <p className="muted">Revenue bar graph (Monday-Sunday)</p>
            <div className="weekday-chart" role="img" aria-label="Revenue bar graph from Monday to Sunday">
              {weekdayData.map((point) => {
                const height = (point.value / maxWeekdayRevenue) * 100;
                return (
                  <div className="weekday-col" key={point.label}>
                    <p className="weekday-value">{formatCurrency(point.value)}</p>
                    <div className="weekday-bar-track">
                      <span className="weekday-bar-fill" style={{ height: `${height}%` }} />
                    </div>
                    <p className="weekday-day">{point.shortLabel}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <p className="muted">Top sellers</p>
            {topSellers.length === 0 ? <p className="empty">No top seller data available yet.</p> : null}
            <div className="top-sellers-list">
              {topSellers.map((seller) => (
                <article key={seller.name} className="top-seller-item">
                  <p>{seller.name}</p>
                  <p className="muted">
                    {seller.qty_sold} sold - {formatCurrency(seller.revenue)}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </article>
    </section>
  );
}
