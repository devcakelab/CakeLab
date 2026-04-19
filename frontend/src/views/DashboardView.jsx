import { useEffect, useMemo, useState } from "react";
import MetricCard from "../components/MetricCard";
import { formatCurrency } from "../lib/posUtils";

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseMonthKey(monthKey) {
  const [yearStr, monthStr] = String(monthKey).split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  return { year, monthIndex };
}

function monthLabel(monthKey) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function shortDateLabel(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fullDateLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function buildWeekOptions(monthKey) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const mondayIndex = 1;

  const firstWeekStart = new Date(monthStart);
  const startOffset = (firstWeekStart.getDay() - mondayIndex + 7) % 7;
  firstWeekStart.setDate(firstWeekStart.getDate() - startOffset);

  const lastWeekEnd = new Date(monthEnd);
  const endOffset = (mondayIndex + 6 - lastWeekEnd.getDay() + 7) % 7;
  lastWeekEnd.setDate(lastWeekEnd.getDate() + endOffset);

  const options = [];
  let weekNumber = 1;

  for (let cursor = new Date(firstWeekStart); cursor <= lastWeekEnd; cursor.setDate(cursor.getDate() + 7)) {
    const startDate = new Date(cursor);
    const endDate = new Date(cursor);
    endDate.setDate(endDate.getDate() + 6);
    options.push({
      id: `${monthKey}-w${weekNumber}`,
      weekNumber,
      startDate,
      endDate,
      label: `Week ${weekNumber} (${shortDateLabel(startDate)} - ${shortDateLabel(endDate)})`,
    });
    weekNumber += 1;
  }
  return options;
}

export default function DashboardView({ stats, insights, sales = [] }) {
  const currentMonthKey = monthKeyFromDate(new Date());
  const monthOptions = useMemo(() => {
    const keys = new Set([currentMonthKey]);
    sales.forEach((sale) => {
      const createdAt = new Date(sale?.created_at);
      if (Number.isNaN(createdAt.getTime())) return;
      keys.add(monthKeyFromDate(createdAt));
    });
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [currentMonthKey, sales]);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const weekOptions = useMemo(() => buildWeekOptions(selectedMonth), [selectedMonth]);
  const [selectedWeekId, setSelectedWeekId] = useState("");

  useEffect(() => {
    if (!monthOptions.includes(selectedMonth)) {
      setSelectedMonth(monthOptions[0] || currentMonthKey);
    }
  }, [currentMonthKey, monthOptions, selectedMonth]);

  useEffect(() => {
    if (!weekOptions.length) {
      setSelectedWeekId("");
      return;
    }

    const today = new Date();
    const defaultWeek =
      selectedMonth === currentMonthKey
        ? weekOptions.find((option) => today >= option.startDate && today <= option.endDate) || weekOptions[0]
        : weekOptions[0];

    setSelectedWeekId((current) => (weekOptions.some((option) => option.id === current) ? current : defaultWeek.id));
  }, [currentMonthKey, selectedMonth, weekOptions]);

  const selectedWeek = weekOptions.find((option) => option.id === selectedWeekId) || weekOptions[0] || null;

  const revenueByDate = useMemo(() => {
    const map = new Map();
    sales.forEach((sale) => {
      const createdAt = new Date(sale?.created_at);
      if (Number.isNaN(createdAt.getTime())) return;
      const key = dateKeyFromDate(createdAt);
      map.set(key, (map.get(key) || 0) + Number(sale?.total || 0));
    });
    return map;
  }, [sales]);

  const weekdayData = useMemo(() => {
    if (!selectedWeek) return [];
    const days = [];
    const cursor = new Date(selectedWeek.startDate);
    while (cursor <= selectedWeek.endDate && days.length < 7) {
      const dateKey = dateKeyFromDate(cursor);
      days.push({
        label: fullDateLabel(cursor),
        shortLabel: cursor.toLocaleDateString(undefined, { weekday: "short" }),
        dateLabel: shortDateLabel(cursor),
        value: revenueByDate.get(dateKey) || 0,
        isOutsideSelectedMonth: monthKeyFromDate(cursor) !== selectedMonth,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [revenueByDate, selectedMonth, selectedWeek]);

  const maxWeekdayRevenue = Math.max(...weekdayData.map((point) => point.value), 1);
  const peakDay = weekdayData.reduce(
    (best, point) => (point.value > best.value ? point : best),
    { label: "No data", shortLabel: "N/A", dateLabel: "", value: 0 }
  );
  const selectedRangeLabel = selectedWeek
    ? `${fullDateLabel(selectedWeek.startDate)} - ${fullDateLabel(selectedWeek.endDate)}`
    : "No week selected";
  const topSellers = insights?.top_sellers || [];
  const pieColors = ["#ff4fa3", "#7a5bd6", "#f59e0b", "#22c55e", "#06b6d4", "#ef4444"];
  const topSellerTotal = topSellers.reduce((sum, seller) => sum + Number(seller.revenue || 0), 0);
  const topSellerSlices =
    topSellerTotal > 0
      ? topSellers.map((seller, idx) => ({
          name: seller.name,
          revenue: Number(seller.revenue || 0),
          qty_sold: Number(seller.qty_sold || 0),
          color: pieColors[idx % pieColors.length],
        }))
      : [];

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
            <p className="muted">Revenue bar graph by selected month and week</p>
            <div className="weekday-controls">
              <label className="weekday-control">
                <span>Month</span>
                <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                  {monthOptions.map((monthKey) => (
                    <option key={monthKey} value={monthKey}>
                      {monthLabel(monthKey)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="weekday-control">
                <span>Week</span>
                <select value={selectedWeekId} onChange={(event) => setSelectedWeekId(event.target.value)}>
                  {weekOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="weekday-chart-note">
              Showing: <strong>{selectedRangeLabel}</strong>
            </p>
            <p className="weekday-chart-note">
              Peak day: <strong>{peakDay.shortLabel}</strong> ({peakDay.dateLabel}) - {formatCurrency(peakDay.value)}
            </p>
            <div
              className="weekday-chart"
              style={{ gridTemplateColumns: `repeat(${Math.max(weekdayData.length, 1)}, minmax(0, 1fr))` }}
              role="img"
              aria-label={`Revenue bar graph for ${selectedRangeLabel}`}
            >
              {weekdayData.map((point) => {
                const height = (point.value / maxWeekdayRevenue) * 100;
                const isPeak = point.label === peakDay.label;
                return (
                  <div
                    className={`weekday-col${isPeak ? " weekday-col-peak" : ""}${point.isOutsideSelectedMonth ? " weekday-col-outside" : ""}`}
                    key={point.label}
                    aria-label={`${point.label}: ${formatCurrency(point.value)}`}
                  >
                    <p className="weekday-value">{formatCurrency(point.value)}</p>
                    <div className="weekday-bar-track">
                      <span
                        className="weekday-bar-fill"
                        style={{ height: `${height}%` }}
                        title={`${point.label}: ${formatCurrency(point.value)} (${Math.round(
                          (point.value / maxWeekdayRevenue) * 100
                        )}% of peak)`}
                      />
                    </div>
                    <p className="weekday-day">{point.shortLabel}</p>
                    <p className="weekday-date">{point.dateLabel}</p>
                    <p className="weekday-share">{Math.round((point.value / maxWeekdayRevenue) * 100)}%</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="top-sellers-section">
            <p className="muted">Top sellers</p>
            {topSellers.length === 0 ? <p className="empty">No top seller data available yet.</p> : null}

            {topSellerSlices.length ? (
              <div className="top-sellers-pie">
                <div className="pie-wrap" aria-label="Top sellers revenue pie chart" role="img">
                  <svg viewBox="0 0 120 120" className="pie-chart">
                    {(() => {
                      let angle = 0;
                      return topSellerSlices.map((slice) => {
                        const pct = slice.revenue / topSellerTotal;
                        const start = angle;
                        const end = angle + pct * 360;
                        angle = end;
                        return <path key={slice.name} d={arcPath(60, 60, 54, start, end)} fill={slice.color} />;
                      });
                    })()}
                    <circle cx="60" cy="60" r="32" fill="var(--surface-soft)" />
                    <text x="60" y="56" textAnchor="middle" className="pie-center-value">
                      {formatCurrency(topSellerTotal)}
                    </text>
                    <text x="60" y="72" textAnchor="middle" className="pie-center-label">
                      top revenue
                    </text>
                  </svg>

                  <div className="pie-legend pie-legend-bottom" aria-label="Pie chart legend">
                    {topSellerSlices.map((slice) => (
                      <div className="pie-legend-row" key={`${slice.name}-${slice.color}`}>
                        <span className="pie-dot" style={{ background: slice.color }} aria-hidden="true" />
                        <div className="pie-legend-main">
                          <p className="pie-legend-name">{slice.name}</p>
                          <p className="muted pie-legend-meta">
                            {slice.qty_sold} sold · {formatCurrency(slice.revenue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </article>
    </section>
  );
}
