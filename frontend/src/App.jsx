import { useEffect, useMemo, useState } from "react";
import MetricCard from "./components/MetricCard";
import Toast from "./components/Toast";
import { NAV_ITEMS } from "./constants/navigation";
import { api } from "./lib/api";
import { formatCurrency } from "./lib/formatters";
import { buildSkuFromName, productIcon } from "./lib/product";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [authMode, setAuthMode] = useState("login");

  const [loginForm, setLoginForm] = useState({ username: "admin", password: "admin123" });
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [resetForm, setResetForm] = useState({
    username: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [products, setProducts] = useState([]);
  const [sections, setSections] = useState([]);
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [sales, setSales] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [reportPeriod, setReportPeriod] = useState("daily");
  const [performanceRows, setPerformanceRows] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [cart, setCart] = useState([]);

  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [receiptEmailStatus, setReceiptEmailStatus] = useState(null);

  const [inventoryForm, setInventoryForm] = useState({
    name: "",
    price: "",
    stock: "",
    low_stock_threshold: "10",
    section: "",
  });

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * Number(item.price), 0),
    [cart]
  );

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      const matchSearch =
        q.length === 0 ||
        product.name.toLowerCase().includes(q);
      const matchSection = sectionFilter === "all" || String(product.section || "") === sectionFilter;
      return matchSearch && matchSection;
    });
  }, [products, searchTerm, sectionFilter]);

  function showToast(message, type = "info") {
    setToast({ message, type });
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadProducts() {
    const res = await api.get("/products");
    setProducts(res.data);
  }

  async function loadSections() {
    const res = await api.get("/sections");
    setSections(res.data);
  }

  async function loadStats() {
    try {
      const res = await api.get("/dashboard/stats");
      setStats(res.data);
    } catch {
      setStats(null);
    }
  }

  async function loadInsights() {
    try {
      const res = await api.get("/dashboard/insights");
      setInsights(res.data);
    } catch {
      setInsights(null);
    }
  }

  async function loadSales() {
    try {
      const res = await api.get("/sales");
      setSales(res.data);
    } catch {
      setSales([]);
    }
  }

  async function loadReport(period = reportPeriod) {
    try {
      const res = await api.get(`/reports?period=${period}`);
      setReportRows(res.data);
    } catch {
      setReportRows([]);
    }
  }

  async function loadPerformance() {
    try {
      const res = await api.get("/users/performance");
      setPerformanceRows(res.data);
    } catch {
      setPerformanceRows([]);
    }
  }

  async function loadSession() {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      setUser(null);
    }
  }

  async function loadPrivateData() {
    await Promise.all([
      loadStats(),
      loadInsights(),
      loadSales(),
      loadReport(reportPeriod),
      loadPerformance(),
    ]);
  }

  async function loadPublicData() {
    await Promise.all([loadProducts(), loadSections(), loadSession()]);
  }

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      try {
        await loadPublicData();
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (user) {
      loadPrivateData();
    } else {
      setStats(null);
      setInsights(null);
      setSales([]);
      setReportRows([]);
      setPerformanceRows([]);
      setReceipt(null);
      setSelectedSaleId(null);
    }
  }, [user]);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await api.post("/auth/login", loginForm);
      setUser(res.data.user);
      showToast("Logged in successfully.", "success");
    } catch (err) {
      showToast(err.response?.data?.detail || "Login failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function register(event) {
    event.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      return showToast("Passwords do not match.", "error");
    }
    setBusy(true);
    try {
      await api.post("/auth/register", {
        username: registerForm.username,
        password: registerForm.password,
        full_name: registerForm.fullName,
      });
      setLoginForm({ username: registerForm.username, password: registerForm.password });
      setRegisterForm({ fullName: "", username: "", password: "", confirmPassword: "" });
      setAuthMode("login");
      showToast("Registration successful. You can now log in.", "success");
    } catch (err) {
      showToast(err.response?.data?.detail || "Registration failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      return showToast("Passwords do not match.", "error");
    }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", {
        username: resetForm.username,
        new_password: resetForm.newPassword,
      });
      setLoginForm({ username: resetForm.username, password: resetForm.newPassword });
      setResetForm({ username: "", newPassword: "", confirmPassword: "" });
      setAuthMode("login");
      showToast("Password reset successful. Please log in.", "success");
    } catch (err) {
      showToast(err.response?.data?.detail || "Password reset failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
    setCart([]);
    showToast("Logged out.", "info");
  }

  function addToCart(product) {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (!found) {
        return [...current, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
      }
      return current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    });
    showToast("Added to cart.", "success");
  }

  function adjustCart(productId, delta) {
    setCart((current) =>
      current
        .map((item) => (item.id === productId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  }

  function removeCartItem(productId) {
    setCart((current) => current.filter((item) => item.id !== productId));
  }

  async function checkout() {
    if (!user) return showToast("Login required for checkout.", "error");
    if (cart.length === 0) return showToast("Cart is empty.", "error");

    setBusy(true);
    try {
      const payload = {
        customer_name: "Walk-in Customer",
        items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      };
      const res = await api.post("/checkout", payload);
      setCart([]);
      showToast(`Checkout completed. Sale #${res.data.sale_id}`, "success");
      await Promise.all([loadProducts(), loadPrivateData()]);
      setActiveTab("sales");
    } catch (err) {
      showToast(err.response?.data?.detail || "Checkout failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function createProduct(event) {
    event.preventDefault();
    if (!user) return showToast("Login required for inventory changes.", "error");

    setBusy(true);
    try {
      await api.post("/products", {
        sku: buildSkuFromName(inventoryForm.name),
        ...inventoryForm,
        price: Number(inventoryForm.price),
        stock: Number(inventoryForm.stock),
        low_stock_threshold: Number(inventoryForm.low_stock_threshold),
        section: inventoryForm.section ? Number(inventoryForm.section) : null,
      });
      setInventoryForm({
        name: "",
        price: "",
        stock: "",
        low_stock_threshold: "10",
        section: "",
      });
      showToast("Product added.", "success");
      await Promise.all([loadProducts(), loadStats()]);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to add product.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(productId, productName) {
    if (!window.confirm(`Delete ${productName}? This cannot be undone.`)) return;
    try {
      await api.delete(`/products/${productId}`);
      showToast("Product deleted.", "success");
      await Promise.all([loadProducts(), loadStats()]);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to delete product.", "error");
    }
  }

  async function fetchReceipt(saleId) {
    try {
      const res = await api.get(`/sales/${saleId}`);
      setSelectedSaleId(saleId);
      setReceipt(res.data);
      setReceiptEmail("");
      setReceiptEmailStatus(null);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to load receipt.", "error");
    }
  }

  async function sendReceiptEmail() {
    if (!selectedSaleId) return;
    if (!receiptEmail.trim()) {
      showToast("Enter an email address first.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/sales/${selectedSaleId}/receipt/email`, {
        email: receiptEmail.trim(),
      });
      setReceiptEmailStatus({
        type: "success",
        message: res.data?.detail || "Receipt emailed successfully.",
      });
      showToast(res.data?.detail || "Receipt emailed successfully.", "success");
    } catch (err) {
      setReceiptEmailStatus({
        type: "error",
        message: err.response?.data?.detail || "Failed to send receipt email.",
      });
      showToast(err.response?.data?.detail || "Failed to send receipt email.", "error");
    } finally {
      setBusy(false);
    }
  }

  function renderLogin() {
    return (
      <main className="login-page">
        <div className="login-glow login-glow-left" aria-hidden="true" />
        <div className="login-glow login-glow-right" aria-hidden="true" />
        <section className="login-card login-card-glass" aria-labelledby="login-title">
          <h1 id="login-title" className="login-title">
            {authMode === "login" ? "Login" : authMode === "register" ? "Register" : "Reset Password"}
          </h1>
          <p className="login-subtitle">CakeLab</p>
          {authMode === "login" ? (
            <form onSubmit={login} className="login-form" aria-label="Login form">
              <label className="login-field">
                <span>Email or Username</span>
                <input
                  className="login-input"
                  placeholder="you@example.com"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm((s) => ({ ...s, username: e.target.value }))}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="login-field">
                <span>Password</span>
                <input
                  className="login-input"
                  type="password"
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((s) => ({ ...s, password: e.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </label>

              <div className="login-meta-row">
                <label className="login-check">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <button type="button" className="login-link-btn" onClick={() => setAuthMode("reset")}>
                  Forgot password
                </button>
              </div>

              <button className="login-submit" disabled={busy}>
                {busy ? "Signing in..." : "Log in"}
              </button>

              <p className="login-footer">
                Don't have an account?{" "}
                <button type="button" className="login-link-btn" onClick={() => setAuthMode("register")}>
                  Register
                </button>
              </p>
            </form>
          ) : null}

          {authMode === "register" ? (
            <form onSubmit={register} className="login-form" aria-label="Register form">
              <label className="login-field">
                <span>Full name</span>
                <input
                  className="login-input"
                  value={registerForm.fullName}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, fullName: e.target.value }))}
                  required
                />
              </label>
              <label className="login-field">
                <span>Username</span>
                <input
                  className="login-input"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, username: e.target.value }))}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="login-field">
                <span>Password</span>
                <input
                  className="login-input"
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label className="login-field">
                <span>Confirm password</span>
                <input
                  className="login-input"
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button className="login-submit" disabled={busy}>
                {busy ? "Creating..." : "Create account"}
              </button>
              <p className="login-footer">
                Already have an account?{" "}
                <button type="button" className="login-link-btn" onClick={() => setAuthMode("login")}>
                  Log in
                </button>
              </p>
            </form>
          ) : null}

          {authMode === "reset" ? (
            <form onSubmit={resetPassword} className="login-form" aria-label="Reset password form">
              <label className="login-field">
                <span>Username</span>
                <input
                  className="login-input"
                  value={resetForm.username}
                  onChange={(e) => setResetForm((s) => ({ ...s, username: e.target.value }))}
                  required
                />
              </label>
              <label className="login-field">
                <span>New password</span>
                <input
                  className="login-input"
                  type="password"
                  value={resetForm.newPassword}
                  onChange={(e) => setResetForm((s) => ({ ...s, newPassword: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label className="login-field">
                <span>Confirm new password</span>
                <input
                  className="login-input"
                  type="password"
                  value={resetForm.confirmPassword}
                  onChange={(e) => setResetForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button className="login-submit" disabled={busy}>
                {busy ? "Resetting..." : "Reset password"}
              </button>
              <p className="login-footer">
                Remember your password?{" "}
                <button type="button" className="login-link-btn" onClick={() => setAuthMode("login")}>
                  Back to login
                </button>
              </p>
            </form>
          ) : null}
        </section>
      </main>
    );
  }

  function renderPOS() {
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

  function renderDashboard() {
    const weeklyData = insights?.weekly || [];
    const maxWeeklyRevenue = Math.max(...weeklyData.map((point) => Number(point.value || 0)), 1);
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
              <p className="muted">Weekly revenue trend</p>
              <div className="chart-list">
                {weeklyData.length === 0 ? <p className="empty">No trend data available yet.</p> : null}
                {weeklyData.map((point) => (
                  <div className="chart-row" key={point.label}>
                    <p className="chart-label">
                      <span>{point.label}</span>
                      <span>{formatCurrency(point.value)}</span>
                    </p>
                    <div className="chart-bar">
                      <span style={{ width: `${(Number(point.value || 0) / maxWeeklyRevenue) * 100}%` }} />
                    </div>
                  </div>
                ))}
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

  function renderInventory() {
    return (
      <section className="view">
        <header className="view-header">
          <h2>Inventory</h2>
          <p className="muted">Manage products and monitor stock health.</p>
        </header>

        <article className="panel">
          <h3>Add product</h3>
          <form onSubmit={createProduct} className="inventory-form">
            <label className="field">
              <span>Name</span>
              <input value={inventoryForm.name} onChange={(e) => setInventoryForm((s) => ({ ...s, name: e.target.value }))} required />
            </label>
            <label className="field">
              <span>Price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={inventoryForm.price}
                onChange={(e) => setInventoryForm((s) => ({ ...s, price: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Stock</span>
              <input
                type="number"
                min="0"
                value={inventoryForm.stock}
                onChange={(e) => setInventoryForm((s) => ({ ...s, stock: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Low stock threshold</span>
              <input
                type="number"
                min="0"
                value={inventoryForm.low_stock_threshold}
                onChange={(e) => setInventoryForm((s) => ({ ...s, low_stock_threshold: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Section</span>
              <select value={inventoryForm.section} onChange={(e) => setInventoryForm((s) => ({ ...s, section: e.target.value }))}>
                <option value="">General</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-primary" disabled={busy}>
              Add product
            </button>
          </form>
        </article>

        <article className="panel">
          <h3>Products</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Section</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const isLow = Number(product.stock) <= Number(product.low_stock_threshold);
                  return (
                    <tr key={product.id} className={isLow ? "row-warning" : ""}>
                      <td>{product.name}</td>
                      <td>{product.section_name || "General"}</td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>
                        {product.stock}
                        {isLow ? <span className="badge">Low</span> : null}
                      </td>
                      <td>
                        <button className="btn-danger" onClick={() => deleteProduct(product.id, product.name)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    );
  }

  function renderSales() {
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

  function renderReports() {
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

  function renderPerformance() {
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

  function renderView() {
    if (activeTab === "dashboard") return renderDashboard();
    if (activeTab === "pos") return renderPOS();
    if (activeTab === "inventory") return renderInventory();
    if (activeTab === "sales") return renderSales();
    if (activeTab === "reports") return renderReports();
    return renderPerformance();
  }

  if (loading) {
    return <main className="loading-screen">Loading CakeLab...</main>;
  }

  if (!user) {
    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        {renderLogin()}
      </>
    );
  }

  return (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <h1>CakeLab</h1>
            <p>{user.full_name}</p>
          </div>
          <nav aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`nav-btn ${activeTab === item.id ? "nav-btn-active" : ""}`}
                onClick={() => setActiveTab(item.id)}
                aria-current={activeTab === item.id ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <button className="btn-ghost logout-btn" onClick={logout}>
            Logout
          </button>
        </aside>

        <main className="content">
          {renderView()}
        </main>
      </div>
    </>
  );
}
