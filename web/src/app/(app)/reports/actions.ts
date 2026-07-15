"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logCashEntry } from "@/lib/cash";

export async function voidSale(saleId: number, reason: string) {
  const supabase = await createClient();

  const { data: sale } = await supabase.from("sales").select("*").eq("id", saleId).eq("is_void", false).single();
  if (!sale) throw new Error("Sale not found or already voided.");

  const { error: updateErr } = await supabase
    .from("sales")
    .update({ is_void: true, void_reason: reason || "Voided by admin", voided_at: new Date().toISOString() })
    .eq("id", saleId);
  if (updateErr) throw new Error(updateErr.message);

  const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", saleId);

  for (const item of items ?? []) {
    const qty = Number(item.quantity);
    if (item.is_consignment) {
      const { data: p } = await supabase.from("products").select("stock").eq("id", item.product_id).single();
      await supabase.from("products").update({ stock: Number(p?.stock ?? 0) + qty }).eq("id", item.product_id);

      // Reverse the liability posted to the supplier at sale time (see
      // pos/actions.ts). If it was already settled/paid out, this correctly
      // goes negative — the supplier now owes that amount back.
      const { data: ledgerRow } = await supabase
        .from("consignment_ledger")
        .select("supplier_id, supplier_due")
        .eq("sale_id", saleId)
        .eq("product_id", item.product_id)
        .maybeSingle();
      if (ledgerRow?.supplier_id && Number(ledgerRow.supplier_due) > 0) {
        const { data: sup } = await supabase.from("suppliers").select("balance").eq("id", ledgerRow.supplier_id).single();
        await supabase.from("suppliers").update({ balance: Number(sup?.balance ?? 0) - Number(ledgerRow.supplier_due) }).eq("id", ledgerRow.supplier_id);
        await supabase.from("supplier_ledger").insert({
          supplier_id: ledgerRow.supplier_id,
          type: "adjustment",
          amount: -Number(ledgerRow.supplier_due),
          note: `Void of sale #${sale.receipt_no} (consignment)`,
        });
      }
      await supabase.from("consignment_ledger").delete().eq("sale_id", saleId).eq("product_id", item.product_id);
    } else if (item.product_type === "bulk") {
      // bulk has no batch tracking, nothing to restore
    } else {
      const { data: p } = await supabase.from("products").select("stock").eq("id", item.product_id).single();
      await supabase.from("products").update({ stock: Number(p?.stock ?? 0) + qty }).eq("id", item.product_id);

      const { data: batch } = await supabase
        .from("batches")
        .select("id, quantity_remaining, quantity_original")
        .eq("product_id", item.product_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (batch) {
        const restore = Math.min(qty, Number(batch.quantity_original));
        const newRemaining = Math.min(Number(batch.quantity_original), Number(batch.quantity_remaining) + restore);
        await supabase.from("batches").update({ quantity_remaining: newRemaining }).eq("id", batch.id);
      }
    }
  }

  if (sale.customer_id) {
    const rate = Math.max(1, Number(sale.exchange_rate_used) || 1);
    let netCashUsd = Number(sale.paid_usd) - Number(sale.change_usd);
    netCashUsd += (Number(sale.paid_lbp) - Number(sale.change_lbp)) / rate;
    const creditUsed = Number(sale.credit_used) || 0;
    const balRestore = Number(sale.total) + creditUsed - netCashUsd;
    if (Math.abs(balRestore) > 0.001) {
      const { data: cust } = await supabase.from("customers").select("balance").eq("id", sale.customer_id).single();
      await supabase.from("customers").update({ balance: Number(cust?.balance ?? 0) + balRestore }).eq("id", sale.customer_id);
      await supabase.from("customer_ledger").insert({
        customer_id: sale.customer_id,
        sale_id: saleId,
        type: "adjustment",
        amount: balRestore,
        note: `Void of sale #${sale.receipt_no}`,
      });
    }
  }

  const netUsd = Number(sale.paid_usd) - Number(sale.change_usd);
  const netLbp = Number(sale.paid_lbp) - Number(sale.change_lbp);
  if (Math.abs(netUsd) > 0.001 || Math.abs(netLbp) > 0.001) {
    const cur = netUsd !== 0 && netLbp !== 0 ? "BOTH" : netLbp !== 0 ? "LBP" : "USD";
    await logCashEntry(supabase, {
      type: "void",
      amountUsd: -netUsd,
      amountLbp: -netLbp,
      note: `Void of sale #${sale.receipt_no}`,
      saleId,
      currency: cur,
    });
  }

  revalidatePath("/reports");
  revalidatePath("/products");
  revalidatePath("/customers");
  revalidatePath("/cash-register");
  return { message: `Sale #${sale.receipt_no} has been voided. Stock has been restored.` };
}

export async function runAnalysis(params: {
  from: string;
  to: string;
  categoryId?: number | null;
  supplierId?: number | null;
  productId?: number | null;
}) {
  const supabase = await createClient();
  const { from, to, categoryId, supplierId, productId } = params;
  const fromTs = `${from}T00:00:00`;
  const toTs = `${to}T23:59:59.999`;

  let saleQuery = supabase
    .from("sale_items")
    .select("quantity, total, product_id, product_name, sales!inner(sale_date, is_void), products!inner(category_id, supplier_id)")
    .eq("sales.is_void", false)
    .gte("sales.sale_date", fromTs)
    .lte("sales.sale_date", toTs);
  if (productId) saleQuery = saleQuery.eq("product_id", productId);
  if (categoryId) saleQuery = saleQuery.eq("products.category_id", categoryId);
  if (supplierId) saleQuery = saleQuery.eq("products.supplier_id", supplierId);
  const { data: saleRows } = await saleQuery;
  const rows = saleRows ?? [];

  const unitsSold = rows.reduce((s, r) => s + Number(r.quantity), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.total), 0);

  const byProduct = new Map<number, { name: string; units: number; revenue: number }>();
  for (const r of rows) {
    const cur = byProduct.get(r.product_id) ?? { name: r.product_name, units: 0, revenue: 0 };
    cur.units += Number(r.quantity);
    cur.revenue += Number(r.total);
    byProduct.set(r.product_id, cur);
  }
  const topProducts = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  let purchaseQuery = supabase
    .from("purchase_items")
    .select("quantity, total, product_id, purchases!inner(purchase_date, supplier_id), products!inner(category_id)")
    .gte("purchases.purchase_date", from)
    .lte("purchases.purchase_date", to);
  if (productId) purchaseQuery = purchaseQuery.eq("product_id", productId);
  if (categoryId) purchaseQuery = purchaseQuery.eq("products.category_id", categoryId);
  if (supplierId) purchaseQuery = purchaseQuery.eq("purchases.supplier_id", supplierId);
  const { data: purchaseRows } = await purchaseQuery;
  const pRows = purchaseRows ?? [];

  const unitsPurchased = pRows.reduce((s, r) => s + Number(r.quantity), 0);
  const purchaseCost = pRows.reduce((s, r) => s + Number(r.total), 0);

  return {
    units_sold: unitsSold,
    revenue,
    units_purchased: unitsPurchased,
    purchase_cost: purchaseCost,
    top_products: topProducts,
  };
}
