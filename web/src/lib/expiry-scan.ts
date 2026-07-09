import type { SupabaseClient } from "@supabase/supabase-js";

// Sweeps every batch whose expiry_date has passed and still has stock remaining,
// writes it off as wastage (reason "expired"), and zeroes it out of both the
// batch and the product's stock total. Called by the daily cron (service-role
// client, every org) and by the manual "Run Expiry Scan" button on the Wastage
// page (request-scoped client, current org only via RLS).
export async function runExpiryScan(supabase: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: batches, error } = await supabase
    .from("batches")
    .select("id, product_id, organization_id, cost_price, quantity_remaining, expiry_date, products(name, unit, stock)")
    .not("expiry_date", "is", null)
    .lt("expiry_date", today)
    .gt("quantity_remaining", 0);

  if (error) throw new Error(error.message);

  let count = 0;
  let totalQty = 0;
  let totalCost = 0;

  for (const batch of batches ?? []) {
    const product = batch.products as unknown as { name: string; unit: string | null; stock: number } | null;
    if (!product) continue;

    const qty = Number(batch.quantity_remaining);
    const unitCost = Number(batch.cost_price);

    const { error: wastageErr } = await supabase.from("wastage").insert({
      organization_id: batch.organization_id,
      product_id: batch.product_id,
      product_name: product.name,
      quantity: qty,
      unit: product.unit,
      unit_cost: unitCost,
      reason: "expired",
      reason_note: `Auto-flagged by expiry scan — batch expired ${batch.expiry_date}`,
      wastage_date: today,
    });
    if (wastageErr) throw new Error(wastageErr.message);

    const { error: batchErr } = await supabase.from("batches").update({ quantity_remaining: 0 }).eq("id", batch.id);
    if (batchErr) throw new Error(batchErr.message);

    const { error: productErr } = await supabase
      .from("products")
      .update({ stock: Math.max(0, Number(product.stock) - qty) })
      .eq("id", batch.product_id);
    if (productErr) throw new Error(productErr.message);

    count += 1;
    totalQty += qty;
    totalCost += qty * unitCost;
  }

  return { count, totalQty, totalCost };
}
