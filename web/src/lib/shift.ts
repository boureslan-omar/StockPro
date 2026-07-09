import type { SupabaseClient } from "@supabase/supabase-js";

export type ShiftStats = {
  salesCount: number;
  salesTotal: number;
  inUsd: number;
  outUsd: number;
  inLbp: number;
  outLbp: number;
};

export async function getShiftStats(supabase: SupabaseClient, since: string | null): Promise<ShiftStats> {
  let salesQuery = supabase
    .from("sales")
    .select("total")
    .eq("is_void", false)
    .eq("payment_method", "cash");
  if (since) salesQuery = salesQuery.gt("sale_date", since);
  const { data: sales } = await salesQuery;

  let logQuery = supabase.from("cash_register_log").select("amount_usd, amount_lbp");
  if (since) logQuery = logQuery.gt("created_at", since);
  const { data: log } = await logQuery;

  const rows = log ?? [];
  return {
    salesCount: (sales ?? []).length,
    salesTotal: (sales ?? []).reduce((s, r) => s + Number(r.total), 0),
    inUsd: rows.reduce((s, r) => s + (Number(r.amount_usd) > 0 ? Number(r.amount_usd) : 0), 0),
    outUsd: rows.reduce((s, r) => s + (Number(r.amount_usd) < 0 ? Math.abs(Number(r.amount_usd)) : 0), 0),
    inLbp: rows.reduce((s, r) => s + (Number(r.amount_lbp) > 0 ? Number(r.amount_lbp) : 0), 0),
    outLbp: rows.reduce((s, r) => s + (Number(r.amount_lbp) < 0 ? Math.abs(Number(r.amount_lbp)) : 0), 0),
  };
}
