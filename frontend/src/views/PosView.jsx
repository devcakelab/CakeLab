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
  setCart,
  customerName,
  setCustomerName,
  orderType,
  setOrderType,
  checkout,
  busy,
}) {
  const canReviewPendingOrders = userRole === "admin" || userRole === "cashier";

  return (
    <section className="view">
      <header className="view-header">
        <h2>Point of Sale</h2>
        <p className="muted">Search quickly and keep checkout visible at all times.</p>
      </header>

      {canReviewPendingOrders ? (
        <article className="panel">
          <h3>Customer Orders</h3>
          {pendingOrders.length === 0 ? (
            <p className="muted">No pending orders.</p>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  style={{ border: "1px solid rgba(107, 114, 128, 0.25)", borderRadius: 10, padding: 12 }}
                >
                  <p>
                    <strong>Order #{order.id}</strong> - {order.customer_name} ({order.order_type})
                  </p>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Requested by {order.created_by_name} - Total {formatCurrency(order.total)}
                  </p>
                  <div className="table-wrap" style={{ marginTop: 10 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Unit Price</th>
                          <th>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items?.map((item, idx) => (
                          <tr key={`${order.id}-${item.sku || item.name}-${idx}`}>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.unit_price)}</td>
                            <td>{formatCurrency(item.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="inline-actions" style={{ marginTop: 12 }}>
                    <button className="btn-primary" onClick={() => approvePendingOrder(order.id)} disabled={busy}>
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
        </article>
      ) : null}

      <div className="pos-layout">
        <article className="panel">
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
            <button className="btn-ghost" onClick={() => setCart([])} disabled={cart.length === 0}>
              Clear cart
            </button>
            <button className="btn-primary" onClick={checkout} disabled={busy || cart.length === 0}>
              {busy ? "Processing..." : "Complete checkout"}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
