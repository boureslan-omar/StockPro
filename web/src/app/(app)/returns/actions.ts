"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logCashEntry } from "@/lib/cash";

export async function processCustomerReturn(formData: FormData) {
  const supabase = await createClient();
  const saleItemId = Number(formData.get("sale_item_id"));
  const returnQty = Number(formData.get("quantity") || 0);
  const note = String(formData.get("note") || "").trim();

  if (!saleItemId || returnQty <= 0) throw new Error("Invalid data.");

  const { data: item } = await supabase
    .from("sale_items")
    .select("*, sales(customer_id, receipt_no), products(product_type, product_source)")
    .eq("id", saleItemId)
    .single();
  if (!item) throw new Error("Sale item not found.");

  const sale = item.sales as unknown as { customer_id: number | null; receipt_no: string | null };
  const product = item.products as unknown as { product_type: string; product_source: string } | null;

  const { data: existingReturns } = await supabase.from("customer_returns").select("quantity").eq("sale_item_id", saleItemId);
  const alreadyReturned = (existingReturns ?? []).reduce((s, r) => s + Number(r.quantity), 0);
  const maxReturn = Number(item.quantity) - alreadyReturned;
  if (returnQty > maxReturn) throw new Error(`Max returnable: ${maxReturn}`);

  const refund = Math.round(returnQty * Number(item.unit_price) * 100) / 100;

  await supabase.from("customer_returns").insert({
    sale_id: item.sale_id,
    sale_item_id: saleItemId,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: returnQty,
    unit_price: item.unit_price,
    refund_amount: refund,
    note,
    return_date: new Date().toISOString().slice(0, 10),
  });

  if (item.product_id) {
    const { data: prod } = await supabase.from("products").select("stock").eq("id", item.product_id).single();
    await supabase.from("products").update({ stock: Number(prod?.stock ?? 0) + returnQty }).eq("id", item.product_id);

    if (product?.product_type === "regular" && product?.product_source === "owned") {
      const { data: batch } = await supabase
        .from("batches")
        .select("id, quantity_remaining")
        .eq("product_id", item.product_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (batch) {
        await supabase.from("batches").update({ quantity_remaining: Number(batch.quantity_remaining) + returnQty }).eq("id", batch.id);
      }
    }
  }

  if (sale?.customer_id) {
    const { data: cust } = await supabase.from("customers").select("balance").eq("id", sale.customer_id).single();
    await supabase.from("customers").update({ balance: Number(cust?.balance ?? 0) + refund }).eq("id", sale.customer_id);
    await supabase.from("customer_ledger").insert({
      customer_id: sale.customer_id,
      sale_id: item.sale_id,
      type: "refund",
      amount: refund,
      note: `Return from receipt ${sale.receipt_no}: ${item.product_name}`,
    });
  }

  await logCashEntry(supabase, {
    type: "refund",
    amountUsd: -refund,
    note: `Refund #${sale?.receipt_no}: ${item.product_name} x${returnQty}`,
    saleId: item.sale_id,
  });

  revalidatePath("/returns");
  return { refund };
}

export async function processSupplierReturn(formData: FormData) {
  const supabase = await createClient();
  const batchId = Number(formData.get("batch_id"));
  const returnQty = Number(formData.get("quantity") || 0);
  const note = String(formData.get("note") || "").trim();
  const refundMethod = String(formData.get("refund_method") || "credit") === "cash" ? "cash" : "credit";
  const suppliedSupplierId = Number(formData.get("supplier_id") || 0) || null;

  if (!batchId || returnQty <= 0) throw new Error("Invalid data.");

  const { data: batch } = await supabase
    .from("batches")
    .select("*, products(name, product_source), purchases(supplier_id)")
    .eq("id", batchId)
    .single();
  if (!batch) throw new Error("Batch not found.");
  if (returnQty > Number(batch.quantity_remaining)) {
    throw new Error(`Cannot return more than remaining: ${batch.quantity_remaining}`);
  }

  const product = batch.products as unknown as { name: string };
  const purchase = batch.purchases as unknown as { supplier_id: number | null } | null;
  const supplierId = purchase?.supplier_id || suppliedSupplierId;

  const credit = Math.round(returnQty * Number(batch.cost_price) * 100) / 100;

  await supabase.from("supplier_returns").insert({
    batch_id: batchId,
    product_id: batch.product_id,
    product_name: product?.name,
    supplier_id: supplierId,
    quantity: returnQty,
    unit_cost: batch.cost_price,
    credit_amount: credit,
    note,
    return_date: new Date().toISOString().slice(0, 10),
  });

  await supabase.from("batches").update({ quantity_remaining: Number(batch.quantity_remaining) - returnQty }).eq("id", batchId);

  const { data: prod } = await supabase.from("products").select("stock").eq("id", batch.product_id).single();
  await supabase
    .from("products")
    .update({ stock: Math.max(0, Number(prod?.stock ?? 0) - returnQty) })
    .eq("id", batch.product_id);

  if (supplierId) {
    if (refundMethod === "cash") {
      await logCashEntry(supabase, { type: "deposit", amountUsd: credit, note: `Supplier cash refund: ${product?.name} x${returnQty}` });
      await supabase
        .from("supplier_ledger")
        .insert({ supplier_id: supplierId, type: "return", amount: 0, note: `Return (cash refund): ${product?.name} x${returnQty} — $${credit} received in cash` });
    } else {
      const { data: s } = await supabase.from("suppliers").select("balance").eq("id", supplierId).single();
      await supabase.from("suppliers").update({ balance: Number(s?.balance ?? 0) - credit }).eq("id", supplierId);
      await supabase
        .from("supplier_ledger")
        .insert({ supplier_id: supplierId, type: "return", amount: -credit, note: `Supplier return: ${product?.name} x${returnQty}` });
    }
  }

  revalidatePath("/returns");
  return { credit, refundMethod };
}
