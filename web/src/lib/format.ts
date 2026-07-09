export function fmtUSD(v: number | string): string {
  return `$${Number(v).toFixed(2)}`;
}

export function fmtLBP(v: number | string): string {
  return `${Math.round(Number(v)).toLocaleString()} LBP`;
}
