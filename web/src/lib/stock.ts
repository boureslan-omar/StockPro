import type { SupabaseClient } from "@supabase/supabase-js";

export async function deductStockFifo(
  supabase: SupabaseClient,
  productId: number,
  qty: number
): Promise<number> {
  const { data, error } = await supabase.rpc("deduct_stock_fifo", {
    p_product_id: productId,
    p_qty: qty,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
