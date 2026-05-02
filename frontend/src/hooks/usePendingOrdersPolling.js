import { useEffect } from "react";
import { api } from "../lib/api";

export function usePendingOrdersPolling({ user, activeTab, setPendingOrders }) {
  useEffect(() => {
    if (!user) return undefined;
    const canSeePendingOrders = user.role === "admin" || user.role === "cashier";
    if (!canSeePendingOrders || activeTab !== "pos") return undefined;

    let isDisposed = false;

    async function refreshPendingOrders() {
      try {
        const res = await api.get("/orders/pending");
        if (!isDisposed) {
          setPendingOrders(Array.isArray(res.data) ? res.data : []);
        }
      } catch {
        if (!isDisposed) {
          setPendingOrders([]);
        }
      }
    }

    refreshPendingOrders();
    const pollId = window.setInterval(refreshPendingOrders, 3000);

    return () => {
      isDisposed = true;
      window.clearInterval(pollId);
    };
  }, [user, activeTab, setPendingOrders]);
}
