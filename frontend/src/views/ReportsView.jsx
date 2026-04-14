import { formatCurrency } from "../lib/formatters";

export default function ReportsView({ reportRows, reportPeriod, setReportPeriod, loadReport, insights }) {
  const maxRevenue = Math.max(...reportRows.map((row) => Number(row.revenue || 0)), 1);
  return (
    <section className="view">
      <header className="view-header">
        <h2>Reports</h2>
        <p className="muted">Track performance trends with clean summaries.</p>
      </header>

      <article className="panel">
        <div className="panel-toolbar">
          <label className="field-inline">
            <span>Period</span>
            <select
              value={reportPeriod}
              onChange={(e) => {
                const period = e.target.value;
                setReportPeriod(period);
                loadReport(period);
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>

        <div className="chart-list">
          {reportRows.length === 0 ? <p className="empty">No report data available.</p> : null}
          {reportRows.map((row) => (
            <div className="chart-row" key={row.period_label}>
              <p className="chart-label">
                <span>{row.period_label}</span>
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
      </article>

      <article className="panel">
        <h3>Top sellers</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {insights?.top_sellers?.length ? (
                insights.top_sellers.map((seller) => (
                  <tr key={seller.name}>
                    <td>{seller.name}</td>
                    <td>{seller.qty_sold}</td>
                    <td>{formatCurrency(seller.revenue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="empty">
                    No top seller data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
