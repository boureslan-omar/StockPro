export function generateReceiptNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(-5).toUpperCase();
  return `RCP-${date}-${rand}`;
}
