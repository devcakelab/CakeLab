import { formatCurrency } from "../lib/posUtils";

export default function PerformanceView({ performanceRows }) {
  return (
    <section className="view">
      <header className="view-header">
        <h2>Team Performance</h2>
        <p className="muted">Rank cashiers by sales count and revenue.</p>
      </header>

      <article className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Cashier</th>
                <th>Username</th>
                <th>Sales</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {performanceRows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty">
                    No user performance data yet.
                  </td>
                </tr>
              ) : (
                performanceRows.map((row, idx) => (
                  <tr key={row.id}>
                    <td>#{idx + 1}</td>
                    <td>{row.full_name}</td>
                    <td>{row.username}</td>
                    <td>{row.sales_count}</td>
                    <td>{formatCurrency(row.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
