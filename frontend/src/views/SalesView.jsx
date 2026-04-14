import { formatCurrency } from "../lib/formatters";

export default function SalesView({
  sales,
  fetchReceipt,
  receipt,
  selectedSaleId,
  receiptEmail,
  setReceiptEmail,
  sendReceiptEmail,
  busy,
  receiptEmailStatus,
}) {
  return (
    <section className="view">
      <header className="view-header">
        <h2>Sales</h2>
        <p className="muted">Review transactions and open receipts quickly.</p>
      </header>

      <article className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Cashier</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty">
                    No sales yet.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>#{sale.id}</td>
                    <td>{new Date(sale.created_at).toLocaleString()}</td>
                    <td>{sale.customer_name}</td>
                    <td>{sale.cashier_name}</td>
                    <td>{formatCurrency(sale.total)}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="btn-ghost" onClick={() => fetchReceipt(sale.id)}>
                          Receipt
                        </button>
                        <a
                          className="btn-link"
                          href={`${window.location.protocol}//${window.location.hostname}:8000/api/sales/${sale.id}/receipt.pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {receipt && selectedSaleId ? (
          <section className="receipt-box">
            <h3>Receipt #{selectedSaleId}</h3>
            {receipt.items?.map((item) => (
              <p key={`${item.name}-${item.quantity}-${item.line_total}`}>
                {item.name}: {item.quantity} x {formatCurrency(item.unit_price)} = {formatCurrency(item.line_total)}
              </p>
            ))}
            <div className="receipt-email-row">
              <input
                type="email"
                placeholder="customer@email.com"
                value={receiptEmail}
                onChange={(e) => setReceiptEmail(e.target.value)}
                aria-label="Receipt email"
              />
              <button className="btn-primary" onClick={sendReceiptEmail} disabled={busy}>
                Email receipt
              </button>
            </div>
            {receiptEmailStatus ? (
              <p className={`receipt-email-status receipt-email-status-${receiptEmailStatus.type}`}>
                {receiptEmailStatus.message}
              </p>
            ) : null}
          </section>
        ) : null}
      </article>
    </section>
  );
}
