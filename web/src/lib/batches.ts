import type { SupabaseClient } from "@supabase/supabase-js";

// Batches merge when product+cost (and expiry, for expiry-tracked products) match;
// otherwise a new batch is created. Mirrors the original PHP findExistingBatch,
// extended so different expiry dates never get silently merged together.
export async function findOrCreateBatch(
  supabase: SupabaseClient,
  opts: {
    productId: number;
    purchaseId: number;
    costPrice: number;
    qty: number;
    purchaseDate: string;
    expiryDate: string | null;
    trackExpiry: boolean;
  }
): Promise<{ batchId: number; action: "merged" | "new" }> {
  let query = supabase
    .from("batches")
    .select("id, quantity_remaining, quantity_original")
    .eq("product_id", opts.productId)
    .eq("cost_price", opts.costPrice)
    .gt("quantity_remaining", 0);

  query = opts.trackExpiry
    ? opts.expiryDate
      ? query.eq("expiry_date", opts.expiryDate)
      : query.is("expiry_date", null)
    : query;

  const { data: existing } = await query.order("created_at", { ascending: true }).limit(1).maybeSingle();

  if (existing) {
    await supabase
      .from("batches")
      .update({
        quantity_remaining: Number(existing.quantity_remaining) + opts.qty,
        quantity_original: Number(existing.quantity_original) + opts.qty,
      })
      .eq("id", existing.id);
    return { batchId: existing.id, action: "merged" };
  }

  const { data: created, error } = await supabase
    .from("batches")
    .insert({
      product_id: opts.productId,
      purchase_id: opts.purchaseId,
      cost_price: opts.costPrice,
      quantity_original: opts.qty,
      quantity_remaining: opts.qty,
      purchase_date: opts.purchaseDate,
      expiry_date: opts.expiryDate,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { batchId: created.id, action: "new" };
}
