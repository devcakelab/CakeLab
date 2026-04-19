export function formatMoney(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0.00";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatCurrency(value) {
  return `Php ${formatMoney(value)}`;
}

export function buildSkuFromName(name) {
  const clean =
    String(name || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "ITEM";
  return `${clean}${Date.now().toString().slice(-4)}`;
}

export function productIcon(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.includes("brownie") || lower.includes("chocolate")) return "🍫";
  if (lower.includes("cheesecake") || lower.includes("cake")) return "🍰";
  if (lower.includes("cupcake")) return "🧁";
  if (lower.includes("pudding")) return "🍮";
  if (lower.includes("croissant")) return "🥐";
  if (lower.includes("mango")) return "🥭";
  if (lower.includes("bread")) return "🍞";
  return "🍩";
}
