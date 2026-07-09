"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deductStockFifo } from "@/lib/stock";
import { runExpiryScan } from "@/lib/expiry-scan";

const REASONS = ["expired", "damaged", "owner_use", "sample", "lost", "other"];

export async function saveWastage(formData: FormData) {
  const supabase = await createClient();
  const productId = Number(formData.get("product_id") || 0);
  const qty = Number(formData.get("quantity") || 0);
  const reason = String(formData.get("reason") || "");
  const note = String(formData.get("note") || "").trim();
  const wastageDate = String(formData.get("wastage_date") || new Date().toISOString().slice(0, 10));

  if (!productId || qty <= 0 || !REASONS.includes(reason)) {
    throw new Error("Please fill in all required fields correctly.");
  }

  const { data: prod } = await supabase
    .from("products")
    .select("name, unit, stock, cost_price, product_type")
    .eq("id", productId)
    .single();

  if (!prod) throw new Error("Product not found.");
  if (prod.product_type !== "bulk" && qty > Number(prod.stock)) {
    throw new Error(`Quantity exceeds available stock (${prod.stock} ${prod.unit}).`);
  }

  let unitCost = Number(prod.cost_price);
  if (prod.product_type === "regular") {
    unitCost = await deductStockFifo(supabase, productId, qty);
  } else {
    await supabase
      .from("products")
      .update({ stock: Math.max(0, Number(prod.stock) - qty) })
      .eq("id", productId);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("wastage").insert({
    product_id: productId,
    product_name: prod.name,
    quantity: qty,
    unit: prod.unit,
    unit_cost: unitCost,
    reason,
    reason_note: note,
    wastage_date: wastageDate,
    created_by: user?.id ?? null,
  });

  revalidatePath("/wastage");
}

export async function deleteWastage(id: number) {
  const supabase = await createClient();
  const { data: row } = await supabase.from("wastage").select("product_id, quantity").eq("id", id).single();

  if (row) {
    const { data: prod } = await supabase.from("products").select("stock").eq("id", row.product_id).single();
    await supabase
      .from("products")
      .update({ stock: Number(prod?.stock ?? 0) + Number(row.quantity) })
      .eq("id", row.product_id);

    const { data: batch } = await supabase
      .from("batches")
      .select("id, quantity_remaining")
      .eq("product_id", row.product_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (batch) {
      await supabase
        .from("batches")
        .update({ quantity_remaining: Number(batch.quantity_remaining) + Number(row.quantity) })
        .eq("id", batch.id);
    }
  }

  await supabase.from("wastage").delete().eq("id", id);
  revalidatePath("/wastage");
}

export async function runExpiryScanNow() {
  const supabase = await createClient();
  const result = await runExpiryScan(supabase);
  revalidatePath("/wastage");
  revalidatePath("/products");
  if (result.count === 0) return { message: "No expired batches found — nothing to write off." };
  return {
    message: `Wrote off ${result.count} expired batch${result.count === 1 ? "" : "es"} (${result.totalQty.toFixed(2)} units, $${result.totalCost.toFixed(2)} loss) as wastage.`,
  };
}
