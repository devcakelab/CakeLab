import { useState } from "react";
import { formatCurrency, productIcon } from "../lib/posUtils";

export default function PosView({
  userRole,
  pendingOrders,
  approvePendingOrder,
  rejectPendingOrder,
  searchTerm,
  setSearchTerm,
  sectionFilter,
  setSectionFilter,
  sections,
  filteredProducts,
  addToCart,
  cart,
  adjustCart,
  removeCartItem,
  cartTotal,
  clearCart,
  customerName,
  setCustomerName,
  orderType,
  setOrderType,
  amountReceived,
  setAmountReceived,
  checkout,
  busy,
}) {
  const canReviewPendingOrders = userRole === "admin" || userRole === "cashier";
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [seniorDiscountApplied, setSeniorDiscountApplied] = useState(false);
  const [pendingPaymentOpen, setPendingPaymentOpen] = useState(false);
  const [selectedPendingOrder, setSelectedPendingOrder] = useState(null);
  const [pendingAmountReceived, setPendingAmountReceived] = useState("");
  const [pendingSeniorDiscountApplied, setPendingSeniorDiscountApplied] = useState(false);
  const amountReceivedNumber = Number(amountReceived);
  const hasAmountReceived = amountReceived.trim() !== "" && Number.isFinite(amountReceivedNumber) && amountReceivedNumber >= 0;
  const discountAmount = seniorDiscountApplied ? Number((cartTotal * 0.2).toFixed(2)) : 0;
  const payableTotal = Number((cartTotal - discountAmount).toFixed(2));
  const changeAmount = hasAmountReceived ? Number((amountReceivedNumber - payableTotal).toFixed(2)) : 0;
  const hasInsufficientPayment = hasAmountReceived && changeAmount < 0;
  const selectedPendingTotal = Number(selectedPendingOrder?.total || 0);
  const pendingDiscountAmount = pendingSeniorDiscountApplied ? Number((selectedPendingTotal * 0.2).toFixed(2)) : 0;
  const pendingPayableTotal = Number((selectedPendingTotal - pendingDiscountAmount).toFixed(2));
  const pendingAmountReceivedNumber = Number(pendingAmountReceived);
  const hasPendingAmountReceived =
    pendingAmountReceived.trim() !== "" && Number.isFinite(pendingAmountReceivedNumber) && pendingAmountReceivedNumber >= 0;
  const pendingChangeAmount = hasPendingAmountReceived
    ? Number((pendingAmountReceivedNumber - pendingPayableTotal).toFixed(2))
    : 0;
  const hasPendingInsufficientPayment = hasPendingAmountReceived && pendingChangeAmount < 0;

  async function confirmCheckout() {
    const ok = await checkout({ seniorDiscountApplied });
    if (ok) setPaymentOpen(false);
  }

  function openPendingPayment(order) {
    setSelectedPendingOrder(order);
    setPendingAmountReceived("");
    setPendingSeniorDiscountApplied(false);
    setPendingPaymentOpen(true);
  }

  async function confirmPendingOrderApproval() {
    if (!selectedPendingOrder) return;
    await approvePendingOrder(selectedPendingOrder.id, { seniorDiscountApplied: pendingSeniorDiscountApplied });
    setPendingPaymentOpen(false);
    setSelectedPendingOrder(null);
    setPendingAmountReceived("");
    setPendingSeniorDiscountApplied(false);
  }

  return (
    <section className="view">
      <header className="view-header">
        <h2>Point of Sale</h2>
        <p className="muted">Search quickly and keep checkout visible at all times.</p>
      </header>

      <div className="pos-layout">
        <article className="panel">
          {canReviewPendingOrders ? (
            <section className="customer-orders-panel">
              <h3>Customer Orders</h3>
              {pendingOrders.length === 0 ? (
                <p className="muted">No pending orders.</p>
              ) : (
                <div className="customer-orders-list customer-orders-scroll">
                  {pendingOrders.map((order) => (
                    <div className="customer-order-card" key={order.id}>
                      <div className="customer-order-top">
                        <p>
                          <strong>Order #{order.id}</strong> - {order.customer_name} ({order.order_type})
                        </p>
                        <strong>{formatCurrency(order.total)}</strong>
                      </div>
                      <p className="muted customer-order-meta">By {order.created_by_name}</p>
                      <details className="customer-order-items">
                        <summary>View {order.items?.length || 0} item(s)</summary>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Line Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items?.map((item, idx) => (
                                <tr key={`${order.id}-${item.sku || item.name}-${idx}`}>
                                  <td>{item.name}</td>
                                  <td>{item.quantity}</td>
                                  <td>{formatCurrency(item.line_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                      <div className="inline-actions customer-order-actions">
                        <button className="btn-primary" onClick={() => openPendingPayment(order)} disabled={busy}>
                          Approve
                        </button>
                        <button className="btn-danger" onClick={() => rejectPendingOrder(order.id)} disabled={busy}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
          <div className="panel-toolbar">
            <input
              placeholder="Search by product name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search products"
            />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              aria-label="Filter by section"
            >
              <option value="all">All sections</option>
              {sections.map((section) => (
                <option value={String(section.id)} key={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>

          <div className="product-grid">
            {filteredProducts.length === 0 ? (
              <p className="empty">No matching products.</p>
            ) : (
              filteredProducts.map((product) => (
                <button key={product.id} className="product-card" onClick={() => addToCart(product)}>
                  <span className="product-icon" aria-hidden="true">
                    {productIcon(product.name)}
                  </span>
                  <span className="product-name">{product.name}</span>
                  <span className="product-meta">Stock {product.stock}</span>
                  <strong>{formatCurrency(product.price)}</strong>
                </button>
              ))
            )}
          </div>
        </article>

        <aside className="panel cart-panel">
          <h3>Current cart</h3>
          {cart.length === 0 ? <p className="empty">No items added yet.</p> : null}
          <div className="cart-list">
            {cart.map((item) => (
              <div className="cart-row" key={item.id}>
                <div>
                  <p className="cart-name">{item.name}</p>
                </div>
                <div className="cart-actions">
                  <button className="btn-ghost" onClick={() => adjustCart(item.id, -1)} aria-label={`Decrease ${item.name}`}>
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button className="btn-ghost" onClick={() => adjustCart(item.id, 1)} aria-label={`Increase ${item.name}`}>
                    +
                  </button>
                  <button className="btn-danger" onClick={() => removeCartItem(item.id)} aria-label={`Remove ${item.name}`}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="checkout-bar">
            <p>Total</p>
            <strong>{formatCurrency(cartTotal)}</strong>
          </div>
          <div className="stack" style={{ marginTop: 14 }}>
            <label className="field">
              <span>Order type</span>
              <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                <option value="walk_in">Walk-in</option>
                <option value="online">Online order</option>
              </select>
            </label>
            <label className="field">
              <span>Customer name (optional)</span>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={orderType === "online" ? "Customer name" : "Walk-in customer"}
              />
            </label>
          </div>
          <div className="checkout-actions">
            <button className="btn-ghost" onClick={clearCart} disabled={cart.length === 0}>
              Clear cart
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setSeniorDiscountApplied(false);
                setPaymentOpen(true);
              }}
              disabled={busy || cart.length === 0}
            >
              {busy ? "Processing..." : "Complete checkout"}
            </button>
          </div>
        </aside>
      </div>

      {paymentOpen ? (
        <div className="payment-modal-backdrop" role="dialog" aria-modal="true" aria-label="Payment confirmation">
          <article className="payment-modal">
            <div className="payment-modal-header">
              <h3>Payment</h3>
              <button className="btn-ghost" onClick={() => setPaymentOpen(false)} disabled={busy} aria-label="Close payment modal">
                x
              </button>
            </div>

            <div className="payment-modal-grid">
              <label className="field">
                <span>Total</span>
                <input value={formatCurrency(cartTotal)} readOnly />
              </label>
              <label className="field">
                <span>Amount given</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <div className="field payment-discount-toggle">
                <span>Discount</span>
                <label className="payment-check">
                  <input
                    type="checkbox"
                    checked={seniorDiscountApplied}
                    onChange={(e) => setSeniorDiscountApplied(e.target.checked)}
                  />
                  <span>Is the customer a Senior Citizen/PWD</span>
                </label>
              </div>
              {seniorDiscountApplied ? (
                <label className="field">
                  <span>Discount (20%)</span>
                  <input value={formatCurrency(discountAmount)} readOnly />
                </label>
              ) : null}
              <label className="field">
                <span>Amount to pay</span>
                <input value={formatCurrency(payableTotal)} readOnly />
              </label>
              <label className="field">
                <span>{hasInsufficientPayment ? "Amount due" : "Change"}</span>
                <input value={formatCurrency(Math.abs(changeAmount || 0))} readOnly />
              </label>
            </div>

            <div className="payment-modal-actions">
              <button className="btn-ghost" onClick={() => setPaymentOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={confirmCheckout}
                disabled={busy || !hasAmountReceived || hasInsufficientPayment}
              >
                {busy ? "Processing..." : "Complete payment"}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {pendingPaymentOpen && selectedPendingOrder ? (
        <div className="payment-modal-backdrop" role="dialog" aria-modal="true" aria-label="Pending order payment confirmation">
          <article className="payment-modal">
            <div className="payment-modal-header">
              <h3>{`Pending Order #${selectedPendingOrder.id}`}</h3>
              <button
                className="btn-ghost"
                onClick={() => setPendingPaymentOpen(false)}
                disabled={busy}
                aria-label="Close pending payment modal"
              >
                x
              </button>
            </div>

            <div className="payment-modal-grid">
              <label className="field">
                <span>Total</span>
                <input value={formatCurrency(selectedPendingTotal)} readOnly />
              </label>
              <label className="field">
                <span>Amount given</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={pendingAmountReceived}
                  onChange={(e) => setPendingAmountReceived(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <div className="field payment-discount-toggle">
                <span>Discount</span>
                <label className="payment-check">
                  <input
                    type="checkbox"
                    checked={pendingSeniorDiscountApplied}
                    onChange={(e) => setPendingSeniorDiscountApplied(e.target.checked)}
                  />
                  <span>Is the customer a Senior Citizen/PWD</span>
                </label>
              </div>
              {pendingSeniorDiscountApplied ? (
                <label className="field">
                  <span>Discount (20%)</span>
                  <input value={formatCurrency(pendingDiscountAmount)} readOnly />
                </label>
              ) : null}
              <label className="field">
                <span>Amount to pay</span>
                <input value={formatCurrency(pendingPayableTotal)} readOnly />
              </label>
              <label className="field">
                <span>{hasPendingInsufficientPayment ? "Amount due" : "Change"}</span>
                <input value={formatCurrency(Math.abs(pendingChangeAmount || 0))} readOnly />
              </label>
            </div>

            <div className="payment-modal-actions">
              <button className="btn-ghost" onClick={() => setPendingPaymentOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={confirmPendingOrderApproval}
                disabled={busy || !hasPendingAmountReceived || hasPendingInsufficientPayment}
              >
                {busy ? "Processing..." : "Complete pending checkout"}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
