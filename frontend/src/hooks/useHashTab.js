import { useEffect, useMemo, useState } from "react";

const HASH_TO_TAB = {
  "#dashboard": "dashboard",
  "#pos": "pos",
  "#client-pos": "client_pos",
  "#inventory": "inventory",
  "#sales": "sales",
  "#reports": "reports",
  "#incident-reports": "incident_reports",
  "#accounts": "accounts",
};

function tabFromLocationHash() {
  if (typeof window === "undefined") return "dashboard";
  return HASH_TO_TAB[window.location.hash] || "dashboard";
}

export function useHashTab() {
  const [activeTab, setActiveTab] = useState(() => tabFromLocationHash());

  const tabToHash = useMemo(
    () =>
      Object.entries(HASH_TO_TAB).reduce((acc, [hash, tab]) => {
        acc[tab] = hash;
        return acc;
      }, {}),
    []
  );

  useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(tabFromLocationHash());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function navigateToTab(tabId) {
    setActiveTab(tabId);
    const targetHash = tabToHash[tabId] || `#${String(tabId).replace(/_/g, "-")}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${targetHash}`);
    }
  }

  return { activeTab, setActiveTab, navigateToTab };
}
