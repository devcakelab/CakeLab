import { formatCurrency } from "../lib/formatters";
import { productIcon } from "../lib/product";

export default function PosView({
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
  checkout,
  busy,
}) {
  return (
    <section className="view">
      <header className="view-header">
        <h2>Point of Sale</h2>
        <p className="muted">Search quickly and keep checkout visible at all times.</p>
      </header>

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
