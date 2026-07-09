import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCashBalance(
  supabase: SupabaseClient
): Promise<{ usd: number; lbp: number }> {
  const { data } = await supabase
    .from("cash_register_log")
    .select("amount_usd, amount_lbp");
  const usd = (data ?? []).reduce((s, r) => s + Number(r.amount_usd), 0);
  const lbp = (data ?? []).reduce((s, r) => s + Number(r.amount_lbp), 0);
  return { usd, lbp };
}

export async function logCashEntry(
  supabase: SupabaseClient,
  opts: {
    type: "opening" | "sale" | "withdrawal" | "deposit" | "void" | "expense" | "refund";
    amountUsd?: number;
    amountLbp?: number;
    note?: string;
    saleId?: number | null;
    currency?: "USD" | "LBP" | "BOTH";
  }
) {
  const { usd, lbp } = await getCashBalance(supabase);
  const amountUsd = opts.amountUsd ?? 0;
  const amountLbp = opts.amountLbp ?? 0;
  const balUsd = usd + amountUsd;
  const balLbp = lbp + amountLbp;
  await supabase.from("cash_register_log").insert({
    type: opts.type,
    currency: opts.currency ?? "USD",
    amount_usd: amountUsd,
    amount_lbp: amountLbp,
    note: opts.note ?? "",
    sale_id: opts.saleId ?? null,
    balance_after_usd: balUsd,
    balance_after_lbp: balLbp,
  });
  return { balUsd, balLbp };
}
