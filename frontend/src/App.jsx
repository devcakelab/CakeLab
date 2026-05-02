import { useEffect, useMemo, useState } from "react";
import Toast from "./components/Toast";
import { NAV_ITEMS } from "./constants/navigation";
import { useHashTab } from "./hooks/useHashTab";
import { usePendingOrdersPolling } from "./hooks/usePendingOrdersPolling";
import { api } from "./lib/api";
import { buildSkuFromName } from "./lib/posUtils";
import AccountsView from "./views/AccountsView";
import DashboardView from "./views/DashboardView";
import InventoryView from "./views/InventoryView";
import LoginView from "./views/LoginView";
import PosView from "./views/PosView";
import ReportsView from "./views/ReportsView";
import SalesView from "./views/SalesView";
import IncidentReportsView from "./views/IncidentReportsView";
import ClientPosView from "./views/ClientPosView";

const EMPTY_REGISTER_FORM = { fullName: "", username: "", password: "", confirmPassword: "" };
const EMPTY_RESET_FORM = { username: "", newPassword: "", confirmPassword: "" };
const EMPTY_INVENTORY_FORM = {
  name: "",
  price: "",
  stock: "",
  low_stock_threshold: "10",
  section: "",
  is_ingredient: false,
};

function apiErrorMessage(err, fallback) {
  const payload = err?.response?.data;
  if (!payload) return fallback;
  if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail;
  const firstArrayField = Object.values(payload).find((v) => Array.isArray(v) && v.length > 0);
  if (firstArrayField && typeof firstArrayField[0] === "string") return firstArrayField[0];
  return fallback;
}

function isStrongPassword(value) {
  return /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

function hasRestrictedPasswordChars(value) {
  return /[$'",]/.test(value);
}

export default function App() {
  const { activeTab, navigateToTab } = useHashTab();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [authMode, setAuthMode] = useState("login");

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTER_FORM);
  const [resetForm, setResetForm] = useState(EMPTY_RESET_FORM);

  const [products, setProducts] = useState([]);
  const [sections, setSections] = useState([]);
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [sales, setSales] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [incidentReports, setIncidentReports] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [reportPeriod, setReportPeriod] = useState("daily");
  const [reportStartDate, setReportStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Team Performance removed from UI; keep backend endpoint untouched.

  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [cart, setCart] = useState([]);
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posOrderType, setPosOrderType] = useState("walk_in");
  const [posAmountReceived, setPosAmountReceived] = useState("");

  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [receiptEmailStatus, setReceiptEmailStatus] = useState(null);

  const [inventoryForm, setInventoryForm] = useState(EMPTY_INVENTORY_FORM);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * Number(item.price), 0),
    [cart]
  );
  const madeProducts = useMemo(() => products.filter((product) => !product.is_ingredient), [products]);
  const ingredientProducts = useMemo(() => products.filter((product) => product.is_ingredient), [products]);

  const activeMadeProducts = useMemo(() => madeProducts.filter((p) => !p.is_archived), [madeProducts]);
  const activeIngredientProducts = useMemo(() => ingredientProducts.filter((p) => !p.is_archived), [ingredientProducts]);
  const archivedMadeProducts = useMemo(() => madeProducts.filter((p) => p.is_archived), [madeProducts]);
  const archivedIngredientProducts = useMemo(() => ingredientProducts.filter((p) => p.is_archived), [ingredientProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activeMadeProducts.filter((product) => {
      const matchSearch = q.length === 0 || product.name.toLowerCase().includes(q);
      const matchSection = sectionFilter === "all" || String(product.section || "") === sectionFilter;
      return matchSearch && matchSection;
    });
  }, [activeMadeProducts, searchTerm, sectionFilter]);

  const showToast = (message, type = "info") => setToast({ message, type });

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadProducts() {
    const res = await api.get("/products?include_archived=1");
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

  async function loadPendingOrders() {
    try {
      const res = await api.get("/orders/pending");
      setPendingOrders(res.data);
    } catch {
      setPendingOrders([]);
    }
  }

  async function loadReport(period = reportPeriod, startDate = reportStartDate, endDate = reportEndDate) {
    try {
      const query = new URLSearchParams({ period });
      query.set("tz_offset_minutes", String(new Date().getTimezoneOffset()));
      if (period === "daily") {
        if (startDate) query.set("start_date", startDate);
        if (endDate) query.set("end_date", endDate);
      }
      const res = await api.get(`/reports?${query.toString()}`);
      setReportRows(res.data);
    } catch {
      setReportRows([]);
    }
  }

  async function loadAccounts() {
    try {
      const res = await api.get("/accounts");
      setAccounts(res.data);
    } catch {
      setAccounts([]);
    }
  }

  async function loadIncidentReports() {
    try {
      const res = await api.get("/incident-reports");
      setIncidentReports(Array.isArray(res.data) ? res.data : []);
    } catch {
      setIncidentReports([]);
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
    const allowedTabs = new Set(user?.allowed_tabs || []);
    const tasks = [];
    if (allowedTabs.has("dashboard")) {
      tasks.push(loadStats(), loadInsights());
    } else {
      setStats(null);
      setInsights(null);
    }
    if (allowedTabs.has("sales")) {
      tasks.push(loadSales());
      tasks.push(loadReport(reportPeriod, reportStartDate, reportEndDate));
    } else {
      setSales([]);
      setReportRows([]);
    }
    if (allowedTabs.has("pos") && user?.role !== "guest") {
      tasks.push(loadPendingOrders());
    } else {
      setPendingOrders([]);
    }
    if (allowedTabs.has("accounts")) {
      tasks.push(loadAccounts());
    } else {
      setAccounts([]);
    }
    if (allowedTabs.has("incident_reports")) {
      tasks.push(loadIncidentReports());
    } else {
      setIncidentReports([]);
    }
    await Promise.all(tasks);
  }

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      try {
        await Promise.all([loadProducts(), loadSections(), loadSession()]);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (user) {
      loadPrivateData();
      return;
    }
    setStats(null);
    setInsights(null);
    setSales([]);
    setPendingOrders([]);
    setAccounts([]);
    setIncidentReports([]);
    setReportRows([]);
    setReceipt(null);
    setSelectedSaleId(null);
  }, [user]);

  usePendingOrdersPolling({ user, activeTab, setPendingOrders });

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
    if (registerForm.password.length < 6) return showToast("Password must be at least 6 characters.", "error");
    if (hasRestrictedPasswordChars(registerForm.password)) {
      return showToast('Password cannot contain $, ", \', or comma (,).', "error");
    }
    if (!isStrongPassword(registerForm.password)) {
      return showToast(
        "Password must include at least 1 uppercase, 1 lowercase, 1 number, and 1 symbol.",
        "error"
      );
    }
    if (registerForm.password !== registerForm.confirmPassword) return showToast("Passwords do not match.", "error");

    setBusy(true);
    try {
      await api.post("/auth/register", {
        username: registerForm.username,
        password: registerForm.password,
        full_name: registerForm.fullName,
      });
      setLoginForm({ username: registerForm.username, password: registerForm.password });
      setRegisterForm(EMPTY_REGISTER_FORM);
      setAuthMode("login");
      showToast("Registration successful. You can now log in.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err, "Registration failed."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    if (resetForm.newPassword.length < 6) return showToast("New password must be at least 6 characters.", "error");
    if (resetForm.newPassword !== resetForm.confirmPassword) return showToast("Passwords do not match.", "error");

    setBusy(true);
    try {
      await api.post("/auth/reset-password", {
        username: resetForm.username,
        new_password: resetForm.newPassword,
      });
      setLoginForm({ username: resetForm.username, password: resetForm.newPassword });
      setResetForm(EMPTY_RESET_FORM);
      setAuthMode("login");
      showToast("Password reset successful. Please log in.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err, "Password reset failed."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
    setCart([]);
    setPosAmountReceived("");
    showToast("Logged out.", "info");
  }

  function addToCart(product) {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (!found) return [...current, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
      return current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    });
    showToast("Added to cart.", "success");
  }

  const adjustCart = (productId, delta) =>
    setCart((current) =>
      current
        .map((item) => (item.id === productId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  const removeCartItem = (productId) => setCart((current) => current.filter((item) => item.id !== productId));
  const clearPosCart = () => {
    setCart([]);
    setPosAmountReceived("");
  };

  async function checkout({ seniorDiscountApplied = false } = {}) {
    if (!user) {
      showToast("Login required for checkout.", "error");
      return false;
    }
    if (cart.length === 0) {
      showToast("Cart is empty.", "error");
      return false;
    }
    const amountReceivedNumber = Number(posAmountReceived);
    const hasAmountReceived =
      posAmountReceived.trim() !== "" && Number.isFinite(amountReceivedNumber) && amountReceivedNumber >= 0;
    const payableTotal = seniorDiscountApplied ? Number((cartTotal * 0.8).toFixed(2)) : cartTotal;
    if (!hasAmountReceived) {
      showToast("Enter amount received.", "error");
      return false;
    }
    if (amountReceivedNumber < payableTotal) {
      showToast("Amount received is not enough.", "error");
      return false;
    }

    setBusy(true);
    try {
      const payload = {
        customer_name: posCustomerName.trim(),
        order_type: posOrderType,
        senior_discount_applied: seniorDiscountApplied,
        items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      };
      const res = await api.post("/checkout", payload);
      setCart([]);
      setPosCustomerName("");
      setPosOrderType("walk_in");
      setPosAmountReceived("");
      if (res.data?.pending_order_id) {
        showToast(`Order sent for approval. Pending #${res.data.pending_order_id}`, "success");
      } else {
        showToast(`Checkout completed. Sale #${res.data.sale_id}`, "success");
        navigateToTab("sales");
      }
      await Promise.all([loadProducts(), loadPrivateData()]);
      return true;
    } catch (err) {
      showToast(err.response?.data?.detail || "Checkout failed.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitClientOrder() {
    if (cart.length === 0) {
      showToast("Cart is empty.", "error");
      return { ok: false, pendingOrderId: null };
    }

    setBusy(true);
    try {
      const payload = {
        customer_name: posCustomerName.trim(),
        order_type: posOrderType,
        items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      };
      const res = await api.post("/orders/submit", payload);
      setCart([]);
      setPosCustomerName("");
      setPosOrderType("walk_in");
      setPosAmountReceived("");
      if (res.data?.pending_order_id) {
        showToast(`Order submitted. Pending #${res.data.pending_order_id}`, "success");
      } else {
        showToast(res.data?.detail || "Order submitted for approval.", "success");
      }
      return { ok: true, pendingOrderId: res.data?.pending_order_id || null, status: res.data?.status || null };
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to submit order.", "error");
      return { ok: false, pendingOrderId: null };
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
        is_ingredient: Boolean(inventoryForm.is_ingredient),
        section: inventoryForm.section ? Number(inventoryForm.section) : null,
      });
      setInventoryForm(EMPTY_INVENTORY_FORM);
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

  async function archiveProduct(productId, productName) {
    if (!window.confirm(`Archive ${productName}? It will be hidden from POS and Inventory.`)) return;
    try {
      await api.put(`/products/${productId}`, { is_archived: true });
      showToast("Product archived.", "success");
      await Promise.all([loadProducts(), loadStats()]);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to archive product.", "error");
    }
  }

  async function restoreProduct(productId, productName) {
    if (!window.confirm(`Restore ${productName}? It will be visible again.`)) return;
    try {
      await api.put(`/products/${productId}`, { is_archived: false });
      showToast("Product restored.", "success");
      await Promise.all([loadProducts(), loadStats()]);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to restore product.", "error");
    }
  }

  async function restockProduct(productId, productName, currentStock) {
    const raw = window.prompt(`Restock ${productName}\n\nCurrent stock: ${currentStock}\nEnter quantity to add:`, "0");
    if (raw === null) return;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) return showToast("Please enter a valid restock quantity.", "error");

    try {
      const nextStock = Number(currentStock) + qty;
      await api.put(`/products/${productId}`, { stock: nextStock });
      showToast("Product restocked.", "success");
      await Promise.all([loadProducts(), loadStats()]);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to restock product.", "error");
    }
  }

  async function createSection(name) {
    if (!user) return showToast("Login required for section changes.", "error");
    try {
      await api.post("/sections", { name });
      await loadSections();
      showToast("Section created.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err, "Failed to create section."), "error");
    }
  }

  async function updateSection(sectionId, name) {
    if (!user) return showToast("Login required for section changes.", "error");
    try {
      await api.put(`/sections/${sectionId}`, { name });
      await loadSections();
      showToast("Section updated.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err, "Failed to update section."), "error");
    }
  }

  async function deleteSection(sectionId) {
    if (!user) return showToast("Login required for section changes.", "error");
    try {
      await api.delete(`/sections/${sectionId}`);
      await loadSections();
      showToast("Section deleted.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err, "Failed to delete section."), "error");
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

  function clearReceipt() {
    setSelectedSaleId(null);
    setReceipt(null);
    setReceiptEmail("");
    setReceiptEmailStatus(null);
  }

  function toggleReceipt(saleId) {
    if (selectedSaleId === saleId) {
      clearReceipt();
      return;
    }
    fetchReceipt(saleId);
  }

  async function sendReceiptEmail() {
    if (!selectedSaleId) return;
    if (!receiptEmail.trim()) return showToast("Enter an email address first.", "error");

    setBusy(true);
    try {
      const res = await api.post(`/sales/${selectedSaleId}/receipt/email`, { email: receiptEmail.trim() });
      setReceiptEmailStatus({ type: "success", message: res.data?.detail || "Receipt emailed successfully." });
      showToast(res.data?.detail || "Receipt emailed successfully.", "success");
    } catch (err) {
      const message = err.response?.data?.detail || "Failed to send receipt email.";
      setReceiptEmailStatus({ type: "error", message });
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function approvePendingOrder(orderId, { seniorDiscountApplied = false } = {}) {
    setBusy(true);
    try {
      await api.post(`/orders/${orderId}/approve`, { senior_discount_applied: seniorDiscountApplied });
      showToast("Pending order approved.", "success");
      await Promise.all([loadPendingOrders(), loadSales(), loadReport(reportPeriod, reportStartDate, reportEndDate)]);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to approve order.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function rejectPendingOrder(orderId) {
    setBusy(true);
    try {
      await api.post(`/orders/${orderId}/reject`);
      showToast("Pending order rejected.", "info");
      await loadPendingOrders();
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to reject order.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function changeAccountRole(userId, role) {
    setBusy(true);
    try {
      const res = await api.put(`/accounts/${userId}/role`, { role });
      showToast(res.data?.detail || "Role updated.", "success");
      await Promise.all([loadAccounts(), loadSession()]);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to update role.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(userId, fullName) {
    if (!window.confirm(`Delete account "${fullName}"? This action cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/accounts/${userId}`);
      showToast("Account deleted.", "success");
      await Promise.all([loadAccounts(), loadSession()]);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to delete account.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function createIncidentReport(payload) {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("sale_id", String(payload.sale_id));
      formData.set("details", payload.details || "");
      if (payload.attachment) {
        formData.set("attachment", payload.attachment);
      }
      const res = await api.post("/incident-reports", formData);
      setIncidentReports((current) => [res.data, ...current]);
      showToast("Incident report saved.", "success");
      return true;
    } catch (err) {
      showToast(apiErrorMessage(err, "Failed to save incident report."), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const viewByTab = {
    dashboard: <DashboardView stats={stats} insights={insights} sales={sales} />,
    pos: (
      <PosView
        userRole={user?.role}
        pendingOrders={pendingOrders}
        approvePendingOrder={approvePendingOrder}
        rejectPendingOrder={rejectPendingOrder}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sectionFilter={sectionFilter}
        setSectionFilter={setSectionFilter}
        sections={sections}
        filteredProducts={filteredProducts}
        addToCart={addToCart}
        cart={cart}
        adjustCart={adjustCart}
        removeCartItem={removeCartItem}
        cartTotal={cartTotal}
        clearCart={clearPosCart}
        customerName={posCustomerName}
        setCustomerName={setPosCustomerName}
        orderType={posOrderType}
        setOrderType={setPosOrderType}
        amountReceived={posAmountReceived}
        setAmountReceived={setPosAmountReceived}
        checkout={checkout}
        busy={busy}
      />
    ),
    client_pos: (
      <ClientPosView
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sectionFilter={sectionFilter}
        setSectionFilter={setSectionFilter}
        sections={sections}
        filteredProducts={filteredProducts}
        addToCart={addToCart}
        cart={cart}
        adjustCart={adjustCart}
        removeCartItem={removeCartItem}
        cartTotal={cartTotal}
        clearCart={clearPosCart}
        customerName={posCustomerName}
        setCustomerName={setPosCustomerName}
        orderType={posOrderType}
        setOrderType={setPosOrderType}
        submitClientOrder={submitClientOrder}
        busy={busy}
      />
    ),
    inventory: (
      <InventoryView
        inventoryForm={inventoryForm}
        setInventoryForm={setInventoryForm}
        createProduct={createProduct}
        sections={sections}
        busy={busy}
        madeProducts={activeMadeProducts}
        ingredientProducts={activeIngredientProducts}
        archivedMadeProducts={archivedMadeProducts}
        archivedIngredientProducts={archivedIngredientProducts}
        deleteProduct={deleteProduct}
        archiveProduct={archiveProduct}
        restoreProduct={restoreProduct}
        restockProduct={restockProduct}
        createSection={createSection}
        updateSection={updateSection}
        deleteSection={deleteSection}
      />
    ),
    sales: (
      <SalesView
        sales={sales}
        toggleReceipt={toggleReceipt}
        receipt={receipt}
        selectedSaleId={selectedSaleId}
        receiptEmail={receiptEmail}
        setReceiptEmail={setReceiptEmail}
        sendReceiptEmail={sendReceiptEmail}
        busy={busy}
        receiptEmailStatus={receiptEmailStatus}
      />
    ),
    reports: (
      <ReportsView
        userRole={user?.role}
        reportRows={reportRows}
        reportPeriod={reportPeriod}
        setReportPeriod={setReportPeriod}
        reportStartDate={reportStartDate}
        setReportStartDate={setReportStartDate}
        reportEndDate={reportEndDate}
        setReportEndDate={setReportEndDate}
        loadReport={loadReport}
      />
    ),
    incident_reports: (
      <IncidentReportsView
        sales={sales}
        incidentReports={incidentReports}
        createIncidentReport={createIncidentReport}
        busy={busy}
      />
    ),
    accounts: (
      <AccountsView
        accounts={accounts}
        currentUserId={user?.id}
        onChangeRole={changeAccountRole}
        onDeleteAccount={deleteAccount}
        busy={busy}
      />
    ),
  };

  if (loading) return <main className="loading-screen">Loading CakeLab...</main>;

  const isPublicClientPosRoute = !user && activeTab === "client_pos";

  if (!user && !isPublicClientPosRoute) {
    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <LoginView
          authMode={authMode}
          setAuthMode={setAuthMode}
          busy={busy}
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          registerForm={registerForm}
          setRegisterForm={setRegisterForm}
          resetForm={resetForm}
          setResetForm={setResetForm}
          onLogin={login}
          onRegister={register}
          onResetPassword={resetPassword}
        />
      </>
    );
  }

  if (!user && isPublicClientPosRoute) {
    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <main className="content">
          <ClientPosView
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sectionFilter={sectionFilter}
            setSectionFilter={setSectionFilter}
            sections={sections}
            filteredProducts={filteredProducts}
            addToCart={addToCart}
            cart={cart}
            adjustCart={adjustCart}
            removeCartItem={removeCartItem}
            cartTotal={cartTotal}
            clearCart={clearPosCart}
            customerName={posCustomerName}
            setCustomerName={setPosCustomerName}
            orderType={posOrderType}
            setOrderType={setPosOrderType}
            submitClientOrder={submitClientOrder}
            busy={busy}
          />
        </main>
      </>
    );
  }

  const allowedTabs = user.allowed_tabs || [
    "dashboard",
    "pos",
    "client_pos",
    "inventory",
    "sales",
    "reports",
    "incident_reports",
    "accounts",
  ];
  // Keep POS and Client POS always reachable when clicked in the sidebar.
  const effectiveAllowedTabs = Array.from(new Set([...allowedTabs, "pos", "client_pos"]));
  const visibleNavItems = NAV_ITEMS.filter((item) => item.id !== "client_pos" && effectiveAllowedTabs.includes(item.id));
  const safeActiveTab = effectiveAllowedTabs.includes(activeTab) ? activeTab : (effectiveAllowedTabs[0] || "pos");

  if (safeActiveTab === "client_pos") {
    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <main className="content">{viewByTab.client_pos}</main>
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
            {visibleNavItems.map((item) => (
              <button
                key={item.id}
                className={`nav-btn ${safeActiveTab === item.id ? "nav-btn-active" : ""}`}
                onClick={() => navigateToTab(item.id)}
                aria-current={safeActiveTab === item.id ? "page" : undefined}
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

        <main className="content">{viewByTab[safeActiveTab] || viewByTab.pos}</main>
      </div>
    </>
  );
}
