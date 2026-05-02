import { useEffect, useMemo, useState } from "react";
import { formatCurrency, productIcon } from "../lib/posUtils";
import { api } from "../lib/api";

const STEPS = [
  { id: 1, title: "Service Type", subtitle: "Dine In or Take Out" },
  { id: 2, title: "Order", subtitle: "Choose your menu" },
  { id: 3, title: "Checkout", subtitle: "Review and pay" },
];

const SERVICE_OPTIONS = [
  { id: "dine_in", label: "Dine In", hint: "Enjoy inside the cafe", orderType: "walk_in" },
  { id: "take_out", label: "Take Out", hint: "Packed and ready to go", orderType: "online" },
];
const CLIENT_PENDING_ORDER_KEY = "client_pending_order_id";
const CLIENT_READY_NOTICE_KEY = "client_ready_notice_order_id";

export default function ClientPosView({
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
  submitClientOrder,
  busy,
}) {
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [serviceType, setServiceType] = useState(orderType === "online" ? "take_out" : "dine_in");
  const [pendingOrder, setPendingOrder] = useState(null);
  const [checkingOrder, setCheckingOrder] = useState(false);
  const [orderStatusOpen, setOrderStatusOpen] = useState(false);
  const [orderReadyNoticeOpen, setOrderReadyNoticeOpen] = useState(false);
  const [orderReadyDetails, setOrderReadyDetails] = useState(null);
  const activeStep = started ? currentStep : 0;
  const selectedService = useMemo(
    () => SERVICE_OPTIONS.find((option) => option.id === serviceType) || SERVICE_OPTIONS[0],
    [serviceType]
  );
  const hasPendingApproval = pendingOrder?.status === "pending";

  async function fetchPendingOrderStatus(orderId, { quiet = false } = {}) {
    const normalizedOrderId = Number(orderId);
    if (!Number.isInteger(normalizedOrderId) || normalizedOrderId <= 0) return null;
    if (!quiet) setCheckingOrder(true);
    try {
      const res = await api.get(`/orders/${normalizedOrderId}/status`);
      const nextOrder = res.data || null;
      setPendingOrder(nextOrder);
      if (nextOrder?.status === "approved") {
        const notifiedOrderId = localStorage.getItem(CLIENT_READY_NOTICE_KEY);
        if (String(notifiedOrderId || "") !== String(normalizedOrderId)) {
          setOrderReadyDetails(nextOrder);
          setOrderReadyNoticeOpen(true);
          localStorage.setItem(CLIENT_READY_NOTICE_KEY, String(normalizedOrderId));
        }
      }
      if (nextOrder?.status === "pending") {
        localStorage.setItem(CLIENT_PENDING_ORDER_KEY, String(normalizedOrderId));
      } else {
        localStorage.removeItem(CLIENT_PENDING_ORDER_KEY);
      }
      return nextOrder;
    } catch {
      setPendingOrder(null);
      localStorage.removeItem(CLIENT_PENDING_ORDER_KEY);
      return null;
    } finally {
      if (!quiet) setCheckingOrder(false);
    }
  }

  useEffect(() => {
    const storedOrderId = localStorage.getItem(CLIENT_PENDING_ORDER_KEY);
    if (storedOrderId) {
      fetchPendingOrderStatus(storedOrderId, { quiet: true });
    }
  }, []);

  useEffect(() => {
    if (!hasPendingApproval || !pendingOrder?.id) return undefined;
    const pollId = window.setInterval(() => {
      fetchPendingOrderStatus(pendingOrder.id, { quiet: true });
    }, 4000);
    return () => window.clearInterval(pollId);
  }, [hasPendingApproval, pendingOrder?.id]);

  useEffect(() => {
    if (!orderReadyNoticeOpen) return undefined;
    const timer = window.setTimeout(() => {
      setOrderReadyNoticeOpen(false);
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [orderReadyNoticeOpen]);

  function startOrdering() {
    setStarted(true);
    setCurrentStep(1);
    setServiceType(orderType === "online" ? "take_out" : "dine_in");
  }

  function chooseService(option) {
    setServiceType(option.id);
    setOrderType(option.orderType);
    setCurrentStep(2);
  }

  async function completeCheckout() {
    const result = await submitClientOrder();
    if (result?.ok) {
      if (result.pendingOrderId) {
        localStorage.setItem(CLIENT_PENDING_ORDER_KEY, String(result.pendingOrderId));
        await fetchPendingOrderStatus(result.pendingOrderId, { quiet: true });
      }
      setStarted(false);
      setCurrentStep(1);
    }
  }

  return (
    <section className="view">
      <header className="view-header">
      </header>

      {!started ? (
        <article className="client-welcome panel">
          <div className="client-welcome-badge">CakeLab</div>
          <h3>Welcome to CakeLab Kiosk</h3>
          <p>
            Welcome to CakeLab. Create your order in three smooth steps: choose your service type, build your order,
            and complete checkout.
          </p>
          <div className="client-welcome-actions">
            <button className="btn-primary client-order-start" onClick={startOrdering}>
              Click to Start Ordering 😁
            </button>
            {hasPendingApproval ? (
              <button
                className="btn-ghost client-order-view"
                onClick={async () => {
                  if (pendingOrder?.id) {
                    await fetchPendingOrderStatus(pendingOrder.id);
                  }
                  setOrderStatusOpen(true);
                }}
                disabled={checkingOrder}
              >
                {checkingOrder ? "Checking..." : "View Order"}
              </button>
            ) : null}
          </div>
        </article>
      ) : (
        <>
          <article className="panel client-stepper">
            {STEPS.map((step) => {
              const isActive = activeStep === step.id;
              const isDone = activeStep > step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`client-step-pill ${isActive ? "client-step-pill-active" : ""} ${isDone ? "client-step-pill-done" : ""}`}
                  onClick={() => {
                    if (step.id <= currentStep) setCurrentStep(step.id);
                  }}
                >
                  <span>{`Step ${step.id}`}</span>
                  <strong>{step.title}</strong>
                  <small>{step.subtitle}</small>
                </button>
              );
            })}
          </article>

          {currentStep === 1 ? (
            <article className="panel">
              <h3>Step 1: Choose service type</h3>
              <p className="muted">Tell us how you want your order prepared.</p>
              <div className="client-service-grid">
                {SERVICE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`client-service-card ${serviceType === option.id ? "client-service-card-active" : ""}`}
                    onClick={() => chooseService(option)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                  </button>
                ))}
              </div>
            </article>
          ) : null}

          {currentStep === 2 ? (
            <div className="client-order-layout">
              <article className="panel">
                <h3>Step 2: Build your order</h3>
                <p className="muted">{selectedService.label} selected. Add your favorites below.</p>
                <div className="panel-toolbar">
                  <input
                    placeholder="Search by product name"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search products"
                  />
                  <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} aria-label="Filter by section">
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

              <aside className="panel">
                <h3>Order Preview</h3>
                {cart.length === 0 ? <p className="empty">No items yet.</p> : null}
                <div className="cart-list">
                  {cart.map((item) => (
                    <div className="cart-row" key={item.id}>
                      <p className="cart-name">{item.name}</p>
                      <div className="cart-actions">
                        <button className="btn-ghost" onClick={() => adjustCart(item.id, -1)}>
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button className="btn-ghost" onClick={() => adjustCart(item.id, 1)}>
                          +
                        </button>
                        <button className="btn-danger" onClick={() => removeCartItem(item.id)}>
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
                  <button className="btn-ghost" onClick={() => setCurrentStep(1)}>
                    Back
                  </button>
                  <button className="btn-primary" onClick={() => setCurrentStep(3)} disabled={cart.length === 0}>
                    Continue to Checkout
                  </button>
                </div>
              </aside>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <article className="panel">
              <h3>Step 3: Checkout</h3>
              <p className="muted">Double-check your order below, then submit it for cashier/admin processing.</p>
              <div className="client-checkout-review">
                {cart.length === 0 ? (
                  <p className="empty">No items in your order yet.</p>
                ) : (
                  cart.map((item) => (
                    <article className="client-review-card" key={item.id}>
                      <div className="client-review-icon" aria-hidden="true">
                        {productIcon(item.name)}
                      </div>
                      <div className="client-review-body">
                        <p className="client-review-name">{item.name}</p>
                        <p className="client-review-meta">
                          Qty {item.quantity} x {formatCurrency(item.price)}
                        </p>
                      </div>
                      <strong className="client-review-total">{formatCurrency(item.quantity * Number(item.price))}</strong>
                    </article>
                  ))
                )}
              </div>
              <div className="stack">
                <label className="field">
                  <span>Service type</span>
                  <input value={selectedService.label} readOnly />
                </label>
                <label className="field">
                  <span>Customer name (optional)</span>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
                </label>
                <label className="field">
                  <span>Amount to pay</span>
                  <input value={formatCurrency(cartTotal)} readOnly />
                </label>
                <label className="field">
                  <span>Payment handling</span>
                  <input value="Cashier/Admin will handle payment at counter." readOnly />
                </label>
              </div>
              <div className="checkout-actions">
                <button className="btn-ghost" onClick={() => setCurrentStep(2)}>
                  Back to Order
                </button>
                <button
                  className="btn-primary"
                  onClick={completeCheckout}
                  disabled={busy || cart.length === 0}
                >
                  {busy ? "Submitting..." : "Submit Order to Cashier"}
                </button>
                <button className="btn-danger" onClick={clearCart} disabled={cart.length === 0}>
                  Clear Cart
                </button>
              </div>
            </article>
          ) : null}
        </>
      )}
      {orderStatusOpen && pendingOrder ? (
        <div className="payment-modal-backdrop" role="dialog" aria-modal="true" aria-label="Client order status">
          <article className="payment-modal">
            <div className="payment-modal-header">
              <h3>{`Order #${pendingOrder.id}`}</h3>
              <button className="btn-ghost" onClick={() => setOrderStatusOpen(false)} aria-label="Close order status">
                x
              </button>
            </div>
            <div className="stack">
              <label className="field">
                <span>Status</span>
                <input value={String(pendingOrder.status || "").toUpperCase()} readOnly />
              </label>
              <label className="field">
                <span>Service type</span>
                <input value={pendingOrder.order_type === "online" ? "Take Out" : "Dine In"} readOnly />
              </label>
              <label className="field">
                <span>Customer name</span>
                <input value={pendingOrder.customer_name || "Walk-in Customer"} readOnly />
              </label>
            </div>
            <div className="client-checkout-review">
              {(pendingOrder.items || []).map((item, idx) => (
                <article className="client-review-card" key={`${pendingOrder.id}-${item.sku || item.name}-${idx}`}>
                  <div className="client-review-icon" aria-hidden="true">
                    {productIcon(item.name)}
                  </div>
                  <div className="client-review-body">
                    <p className="client-review-name">{item.name}</p>
                    <p className="client-review-meta">
                      Qty {item.quantity} x {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <strong className="client-review-total">{formatCurrency(item.line_total)}</strong>
                </article>
              ))}
            </div>
            <div className="checkout-bar">
              <p>Total</p>
              <strong>{formatCurrency(pendingOrder.total || 0)}</strong>
            </div>
            <div className="payment-modal-actions">
              <button className="btn-ghost" onClick={() => setOrderStatusOpen(false)}>
                Close
              </button>
            </div>
          </article>
        </div>
      ) : null}
      {orderReadyNoticeOpen ? (
        <div className="payment-modal-backdrop" role="dialog" aria-modal="true" aria-label="Order ready notification">
          <article className="payment-modal client-ready-modal">
            <header className="client-ready-modal-header">
              <p className="client-ready-modal-kicker">Status Update</p>
              <h3>YOUR ORDER IS READY</h3>
            </header>
            <div className="stack">
              <label className="field">
                <span>Order #</span>
                <input value={orderReadyDetails?.id ? `#${orderReadyDetails.id}` : ""} readOnly />
              </label>
              <label className="field">
                <span>Status</span>
                <input value={String(orderReadyDetails?.status || "approved").toUpperCase()} readOnly />
              </label>
              <label className="field">
                <span>Customer name</span>
                <input value={orderReadyDetails?.customer_name || "Walk-in Customer"} readOnly />
              </label>
            </div>
            <div className="client-checkout-review">
              {(orderReadyDetails?.items || []).map((item, idx) => (
                <article className="client-review-card" key={`ready-${orderReadyDetails?.id}-${item.sku || item.name}-${idx}`}>
                  <div className="client-review-icon" aria-hidden="true">
                    {productIcon(item.name)}
                  </div>
                  <div className="client-review-body">
                    <p className="client-review-name">{item.name}</p>
                    <p className="client-review-meta">
                      Qty {item.quantity} x {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <strong className="client-review-total">{formatCurrency(item.line_total)}</strong>
                </article>
              ))}
            </div>
            <div className="checkout-bar">
              <p>Total</p>
              <strong>{formatCurrency(orderReadyDetails?.total || 0)}</strong>
            </div>
            <div className="payment-modal-actions">
              <button className="btn-primary" onClick={() => setOrderReadyNoticeOpen(false)}>
                Got it
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
