import { Fragment, useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/posUtils";

function toLocalIsoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getIsoWeekStart(year, isoWeek) {
  const tentative = new Date(year, 0, 1 + (isoWeek - 1) * 7);
  const weekday = tentative.getDay();
  const diffToMonday = tentative.getDate() - weekday + (weekday === 0 ? -6 : 1);
  tentative.setDate(diffToMonday);
  return tentative;
}

function formatWeeklyLabel(rawLabel) {
  const match = rawLabel.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return rawLabel;

  const year = Number(match[1]);
  const isoWeek = Number(match[2]);
  const weekStart = getIsoWeekStart(year, isoWeek);
  if (Number.isNaN(weekStart.getTime())) return rawLabel;

  const displayYear = weekStart.getFullYear();
  const monthName = weekStart.toLocaleDateString(undefined, { month: "long" });

  const firstDayOfMonth = new Date(displayYear, weekStart.getMonth(), 1);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const firstMondayOffset = firstDayWeekday === 0 ? 1 : firstDayWeekday === 1 ? 0 : 8 - firstDayWeekday;
  const firstMonday = new Date(displayYear, weekStart.getMonth(), 1 + firstMondayOffset);
  const weekNumberInMonth = Math.max(1, Math.floor((weekStart.getDate() - firstMonday.getDate()) / 7) + 1);

  return `${displayYear} ${monthName} Week ${weekNumberInMonth}`;
}

export default function ReportsView({
  reportRows,
  reportPeriod,
  setReportPeriod,
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  loadReport,
}) {
  const [autoExpandedRange, setAutoExpandedRange] = useState(false);
  const [expandedPeriodLabel, setExpandedPeriodLabel] = useState(null);
  const [periodSalesByLabel, setPeriodSalesByLabel] = useState({});
  const [loadingPeriodLabel, setLoadingPeriodLabel] = useState(null);
  const [detailErrorByLabel, setDetailErrorByLabel] = useState({});
  const rowsAscending = [...reportRows].reverse();
  const hasRows = rowsAscending.length > 0;
  const maxRevenue = Math.max(...rowsAscending.map((row) => Number(row.revenue || 0)), 1);
  const totalRevenue = rowsAscending.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const totalSales = rowsAscending.reduce((sum, row) => sum + Number(row.sale_count || 0), 0);
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const bestPeriod = rowsAscending.reduce(
    (best, row) => (Number(row.revenue || 0) > Number(best.revenue || 0) ? row : best),
    { period_label: "-", revenue: 0, sale_count: 0 }
  );
  const displayedRange =
    reportPeriod === "daily" && reportStartDate && reportEndDate
      ? `${new Date(reportStartDate).toLocaleDateString()} to ${new Date(reportEndDate).toLocaleDateString()}`
      : `Grouped by ${reportPeriod}`;

  function formatSaleDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function saleItemSummary(items) {
    if (!Array.isArray(items) || items.length === 0) return "No items";
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const firstTwo = items.slice(0, 2).map((item) => item.name).filter(Boolean);
    const names = firstTwo.join(", ");
    if (items.length <= 2) return `${totalQuantity} item(s) - ${names}`;
    return `${totalQuantity} item(s) - ${names} +${items.length - 2} more`;
  }

  async function togglePeriodDetails(periodLabel) {
    if (expandedPeriodLabel === periodLabel) {
      setExpandedPeriodLabel(null);
      return;
    }

    setExpandedPeriodLabel(periodLabel);
    if (periodSalesByLabel[periodLabel]) return;

    setLoadingPeriodLabel(periodLabel);
    setDetailErrorByLabel((current) => ({ ...current, [periodLabel]: null }));
    try {
      const query = new URLSearchParams({
        period: reportPeriod,
        period_label: periodLabel,
        tz_offset_minutes: String(new Date().getTimezoneOffset()),
      });
      const res = await api.get(`/reports/details?${query.toString()}`);
      setPeriodSalesByLabel((current) => ({ ...current, [periodLabel]: Array.isArray(res.data) ? res.data : [] }));
    } catch {
      setDetailErrorByLabel((current) => ({
        ...current,
        [periodLabel]: "Unable to load sales for this period. Try again.",
      }));
    } finally {
      setLoadingPeriodLabel((current) => (current === periodLabel ? null : current));
    }
  }

  function formatPeriodLabel(label) {
    const raw = String(label || "");
    if (reportPeriod === "daily") {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      }
      return raw;
    }
    if (reportPeriod === "weekly") {
      return formatWeeklyLabel(raw);
    }
    if (reportPeriod === "monthly") {
      const match = raw.match(/^(\d{4})-(\d{2})$/);
      if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
        return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      }
      return raw;
    }
    if (reportPeriod === "quarterly") {
      const match = raw.match(/^(\d{4})-Q([1-4])$/);
      if (match) return `Q${match[2]} ${match[1]}`;
      return raw;
    }
    return raw;
  }

  useEffect(() => {
    if (reportPeriod !== "daily") {
      setAutoExpandedRange(false);
      return;
    }
    if (reportRows.length > 0) {
      setAutoExpandedRange(false);
      return;
    }
    if (autoExpandedRange || !reportStartDate || !reportEndDate || reportStartDate !== reportEndDate) return;

    const endDate = new Date(reportEndDate);
    if (Number.isNaN(endDate.getTime())) return;
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    const start = toLocalIsoDate(startDate);
    const end = toLocalIsoDate(endDate);

    setAutoExpandedRange(true);
    setReportStartDate(start);
    setReportEndDate(end);
    loadReport("daily", start, end);
  }, [
    autoExpandedRange,
    loadReport,
    reportEndDate,
    reportPeriod,
    reportRows.length,
    reportStartDate,
    setReportEndDate,
    setReportStartDate,
  ]);

  useEffect(() => {
    setExpandedPeriodLabel(null);
  }, [reportPeriod, reportStartDate, reportEndDate, reportRows]);

  return (
    <section className="view">
      <header className="view-header">
        <h2>Reports</h2>
        <p className="muted">Understand sales trends with clear summaries and period-by-period details.</p>
      </header>

      <article className="panel report-panel">
        <section className="report-filters">
          <div className="report-filters-header">
            <div>
              <p className="report-section-label">Filters</p>
              <h3 className="report-section-title">Choose period and date range</h3>
              <p className="muted report-range-text">{displayedRange}</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => loadReport(reportPeriod, reportStartDate, reportEndDate)}>
              Refresh data
            </button>
          </div>

          <div className="reports-toolbar">
            <label className="field-inline report-filter">
              <span>Period</span>
              <select
                value={reportPeriod}
                onChange={(e) => {
                  const period = e.target.value;
                  setReportPeriod(period);
                  loadReport(period, reportStartDate, reportEndDate);
                }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>

            {reportPeriod === "daily" ? (
              <>
                <label className="field-inline report-filter">
                  <span>From</span>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAutoExpandedRange(false);
                      setReportStartDate(next);
                      loadReport("daily", next, reportEndDate);
                    }}
                  />
                </label>
                <label className="field-inline report-filter">
                  <span>To</span>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAutoExpandedRange(false);
                      setReportEndDate(next);
                      loadReport("daily", reportStartDate, next);
                    }}
                  />
                </label>
              </>
            ) : null}
          </div>

          {reportPeriod === "daily" ? (
            <div className="reports-quick-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const today = toLocalIsoDate(new Date());
                  setAutoExpandedRange(false);
                  setReportStartDate(today);
                  setReportEndDate(today);
                  loadReport("daily", today, today);
                }}
              >
                Today
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const today = new Date();
                  const end = toLocalIsoDate(today);
                  const startDate = new Date(today);
                  startDate.setDate(startDate.getDate() - 6);
                  const start = toLocalIsoDate(startDate);
                  setAutoExpandedRange(false);
                  setReportStartDate(start);
                  setReportEndDate(end);
                  loadReport("daily", start, end);
                }}
              >
                Last 7 days
              </button>
            </div>
          ) : null}
        </section>

        <section>
          <p className="report-section-label">Key metrics</p>
          <div className="report-summary-grid">
            <article className="report-summary-card">
              <p className="report-summary-label">Total revenue</p>
              <p className="report-summary-value">{formatCurrency(totalRevenue)}</p>
            </article>
            <article className="report-summary-card">
              <p className="report-summary-label">Total sales</p>
              <p className="report-summary-value">{totalSales}</p>
            </article>
            <article className="report-summary-card">
              <p className="report-summary-label">Average per sale</p>
              <p className="report-summary-value">{formatCurrency(averageTicket)}</p>
            </article>
            <article className="report-summary-card">
              <p className="report-summary-label">Best period</p>
              <p className="report-summary-value report-summary-value-sm">
                {formatPeriodLabel(bestPeriod.period_label)} ({formatCurrency(bestPeriod.revenue)})
              </p>
            </article>
          </div>
        </section>

        <section>
          <div className="report-section-headline">
            <p className="report-section-label">Trend view</p>
            <p className="muted report-hint">Revenue bars are scaled against the highest period in this report.</p>
          </div>
          <div className="chart-list">
            {!hasRows ? <p className="empty">No report data for this filter yet. Try another range and refresh.</p> : null}
            {rowsAscending.map((row) => (
              <div className="chart-row" key={row.period_label}>
                <p className="chart-label">
                  <span>{formatPeriodLabel(row.period_label)}</span>
                  <span>
                    {row.sale_count} sales / {formatCurrency(row.revenue)}
                  </span>
                </p>
                <div className="chart-bar">
                  <span style={{ width: `${(Number(row.revenue) / maxRevenue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="report-section-headline">
            <p className="report-section-label">Detailed breakdown</p>
            <p className="muted report-hint">{rowsAscending.length} period entries</p>
          </div>
          <div className="table-wrap report-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Sales</th>
                  <th>Revenue</th>
                  <th>Avg Sale</th>
                </tr>
              </thead>
              <tbody>
                {rowsAscending.map((row) => {
                  const saleCount = Number(row.sale_count || 0);
                  const revenue = Number(row.revenue || 0);
                  const avgSale = saleCount > 0 ? revenue / saleCount : 0;
                  const isExpanded = expandedPeriodLabel === row.period_label;
                  const salesDetails = periodSalesByLabel[row.period_label] || [];
                  const detailsError = detailErrorByLabel[row.period_label];
                  const isLoadingDetails = loadingPeriodLabel === row.period_label;
                  return (
                    <Fragment key={`detail-${row.period_label}`}>
                      <tr className={`report-period-row ${isExpanded ? "report-period-row-open" : ""}`}>
                        <td>
                          <button
                            type="button"
                            className="report-period-trigger"
                            onClick={() => togglePeriodDetails(row.period_label)}
                            aria-expanded={isExpanded}
                          >
                            <span>{formatPeriodLabel(row.period_label)}</span>
                            <span className="report-period-trigger-hint">Click to view sales details</span>
                          </button>
                        </td>
                        <td>{saleCount}</td>
                        <td>{formatCurrency(revenue)}</td>
                        <td>{formatCurrency(avgSale)}</td>
                      </tr>
                      {isExpanded ? (
                        <tr className="report-period-details-row">
                          <td colSpan={4}>
                            <div className="report-period-details">
                              {isLoadingDetails ? <p className="muted">Loading period details...</p> : null}
                              {!isLoadingDetails && detailsError ? <p className="muted">{detailsError}</p> : null}
                              {!isLoadingDetails && !detailsError && salesDetails.length === 0 ? (
                                <p className="muted">No sales found for this period.</p>
                              ) : null}
                              {!isLoadingDetails && !detailsError && salesDetails.length > 0 ? (
                                <div className="table-wrap">
                                  <table className="report-nested-table">
                                    <thead>
                                      <tr>
                                        <th>Sale #</th>
                                        <th>Date & Time</th>
                                        <th>Customer</th>
                                        <th>Cashier</th>
                                        <th>Items</th>
                                        <th>Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {salesDetails.map((sale) => (
                                        <tr key={`period-sale-${row.period_label}-${sale.id}`}>
                                          <td>#{sale.id}</td>
                                          <td>{formatSaleDateTime(sale.created_at)}</td>
                                          <td>{sale.customer_name || "Walk-in Customer"}</td>
                                          <td>{sale.cashier_name || "-"}</td>
                                          <td>{saleItemSummary(sale.items)}</td>
                                          <td>{formatCurrency(sale.total)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </section>
  );
}
