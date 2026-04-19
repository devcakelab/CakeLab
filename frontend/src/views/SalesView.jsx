import { Fragment } from "react";
import { formatCurrency } from "../lib/posUtils";

export default function SalesView({
  sales,
  toggleReceipt,
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
                  <td colSpan="5" className="empty">
                    No sales yet.
                  </td>
                </tr>
              ) : (
                sales.flatMap((sale) => {
                  const isOpen = selectedSaleId === sale.id;
                  const hasReceipt = isOpen && receipt;
                  return [
                    <Fragment key={sale.id}>
                      <tr>
                        <td>{new Date(sale.created_at).toLocaleString()}</td>
                        <td>{sale.customer_name}</td>
                        <td>{sale.cashier_name}</td>
                        <td>{formatCurrency(sale.total)}</td>
                        <td>
                          <div className="inline-actions">
                            <button className="btn-ghost" onClick={() => toggleReceipt(sale.id)}>
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
                      {isOpen ? (
                        <tr className="receipt-expand-row">
                          <td colSpan="5">
                            <div className={`receipt-expand ${hasReceipt ? "receipt-expand-open" : ""}`}>
                              <div className="receipt-expand-inner">
                                <h3 className="receipt-title">Receipt</h3>
                                {hasReceipt ? (
                                  <>
                                    <div className="receipt-items">
                                      {receipt.items?.map((item) => (
                                        <p key={`${item.name}-${item.quantity}-${item.line_total}`}>
                                          {item.name}: {item.quantity} x {formatCurrency(item.unit_price)} ={" "}
                                          {formatCurrency(item.line_total)}
                                        </p>
                                      ))}
                                    </div>
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
                                      <p
                                        className={`receipt-email-status receipt-email-status-${receiptEmailStatus.type}`}
                                      >
                                        {receiptEmailStatus.message}
                                      </p>
                                    ) : null}
                                  </>
                                ) : (
                                  <p className="empty">Loading receipt…</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>,
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
