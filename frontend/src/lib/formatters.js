export function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

export function formatCurrency(value) {
  return `PHP ${formatMoney(value)}`;
}
