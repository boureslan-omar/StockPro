"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateBatch } from "@/lib/batches";
import { logCashEntry } from "@/lib/cash";

type POItemInput = {
  productId: number | null;
  productName: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  note: string;
  newProductSource: "regular" | "consignment";
};

async function genPONumber(supabase: Awaited<ReturnType<typeof createClient>>) {
  const year = new Date().getFullYear();
  const { data } = await supabase.from("purchase_orders").select("po_number").ilike("po_number", `PO-${year}-%`);
  const max = (data ?? []).reduce((m, r) => {
    const n = parseInt(String(r.po_number).split("-").pop() || "0", 10);
    return Math.max(m, n);
  }, 0);
  return `PO-${year}-${String(max + 1).padStart(4, "0")}`;
}

export async function createPO(formData: FormData) {
  const supabase = await createClient();
  const supplierId = Number(formData.get("supplier_id"));
  const deliveryDate = String(formData.get("delivery_date") || "") || null;
  const note = String(formData.get("note") || "").trim();
  const items: POItemInput[] = JSON.parse(String(formData.get("items_json") || "[]"));

  if (!supplierId || items.length === 0) {
    throw new Error("Please select a supplier and add at least one item.");
  }

  const poNumber = await genPONumber(supabase);
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .insert({ po_number: poNumber, supplier_id: supplierId, delivery_date: deliveryDate, note, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  for (const item of items) {
    if (!item.productName.trim()) continue;
    await supabase.from("purchase_order_items").insert({
      po_id: po.id,
      product_id: item.productId,
      product_name: item.productName.trim(),
      quantity: item.quantity || 1,
      unit: item.unit || "pcs",
      estimated_price: item.estimatedPrice || 0,
      note: item.note || "",
      new_product_source: !item.productId ? item.newProductSource : "regular",
    });
  }

  revalidatePath("/purchase-orders");
  return { message: `Purchase Order ${poNumber} created.` };
}

export async function updatePOStatus(poId: number, status: string) {
  const supabase = await createClient();
  const allowed = ["draft", "sent", "confirmed", "received", "cancelled"];
  if (!allowed.includes(status)) throw new Error("Invalid status.");
  await supabase.from("purchase_orders").update({ status }).eq("id", poId);
  revalidatePath("/purchase-orders");
}

export async function deletePO(poId: number) {
  const supabase = await createClient();
  await supabase.from("purchase_orders").delete().eq("id", poId);
  revalidatePath("/purchase-orders");
}

export async function getPOItems(poId: number) {
  const supabase = await createClient();
  const { data: items } = await supabase.from("purchase_order_items").select("*").eq("po_id", poId);

  const enriched = await Promise.all(
    (items ?? []).map(async (it) => {
      if (!it.product_id) return { ...it, current_cost: 0, sell_price: 0, track_expiry: false, product_source: "owned" };
      const { data: prod } = await supabase
        .from("products")
        .select("cost_price, sell_price, track_expiry, product_source")
        .eq("id", it.product_id)
        .single();
      return {
        ...it,
        current_cost: prod?.cost_price ?? 0,
        sell_price: prod?.sell_price ?? 0,
        track_expiry: prod?.track_expiry ?? false,
        product_source: prod?.product_source ?? "owned",
      };
    })
  );
  return enriched;
}

type ReceiveItemInput = {
  productId: number | null;
  productName: string;
  quantity: number;
  unit: string;
  cost: number;
  sell: number;
  newProductSource: "regular" | "consignment";
  trackExpiry: boolean;
  expiryDate: string | null;
};

export async function receivePO(formData: FormData) {
  const supabase = await createClient();
  const poId = Number(formData.get("po_id"));
  const note = String(formData.get("note") || "").trim();
  const settlementMethod = String(formData.get("settlement_method") || "");
  const settlementAmount = Number(formData.get("settlement_amount") || 0);
  const items: ReceiveItemInput[] = JSON.parse(String(formData.get("items_json") || "[]"));

  const { data: po } = await supabase.from("purchase_orders").select("*").eq("id", poId).single();
  if (!po) throw new Error("Purchase order not found.");
  if (!items.length) throw new Error("No items to receive.");

  const today = new Date().toISOString().slice(0, 10);
  const ref = `${po.po_number}/RCV`;

  // Only owned/regular items count toward supplier cost — consignment is due on sale.
  let totalCost = 0;
  const productSourceCache = new Map<number, string>();
  for (const it of items) {
    let src = it.newProductSource;
    if (it.productId) {
      if (!productSourceCache.has(it.productId)) {
        const { data: p } = await supabase.from("products").select("product_source").eq("id", it.productId).single();
        productSourceCache.set(it.productId, p?.product_source ?? "owned");
      }
      src = productSourceCache.get(it.productId) === "consignment" ? "consignment" : "regular";
    }
    if (src !== "consignment") totalCost += it.quantity * it.cost;
  }

  const { data: purchase, error: purchErr } = await supabase
    .from("purchases")
    .insert({
      supplier_id: po.supplier_id,
      reference: ref,
      purchase_date: today,
      total_amount: totalCost,
      note: note || `Received from PO ${po.po_number}`,
    })
    .select("id")
    .single();
  if (purchErr) throw new Error(purchErr.message);
  const purchaseId = purchase.id;

  if (totalCost > 0) {
    const { data: s } = await supabase.from("suppliers").select("balance").eq("id", po.supplier_id).single();
    await supabase.from("suppliers").update({ balance: Number(s?.balance ?? 0) + totalCost }).eq("id", po.supplier_id);
    await supabase
      .from("supplier_ledger")
      .insert({ supplier_id: po.supplier_id, purchase_id: purchaseId, type: "purchase", amount: totalCost, note: `PO received: ${po.po_number}` });
  }

  for (const it of items) {
    if (!it.productName.trim() || it.quantity <= 0) continue;
    const lineTotal = it.quantity * it.cost;

    if (it.productId) {
      const src = productSourceCache.get(it.productId) === "consignment" ? "consignment" : "regular";
      if (src === "consignment") {
        const { data: prod } = await supabase.from("products").select("stock").eq("id", it.productId).single();
        await supabase
          .from("products")
          .update({ stock: Number(prod?.stock ?? 0) + it.quantity, ...(it.sell > 0 ? { sell_price: it.sell } : {}) })
          .eq("id", it.productId);
        continue;
      }

      const { data: prod } = await supabase.from("products").select("track_expiry, stock").eq("id", it.productId).single();
      if (prod?.track_expiry && !it.expiryDate) throw new Error(`${it.productName} requires an expiry date.`);

      const { batchId, action } = await findOrCreateBatch(supabase, {
        productId: it.productId,
        purchaseId,
        costPrice: it.cost,
        qty: it.quantity,
        purchaseDate: today,
        expiryDate: it.expiryDate,
        trackExpiry: prod?.track_expiry ?? false,
      });
      await supabase.from("purchase_items").insert({
        purchase_id: purchaseId,
        product_id: it.productId,
        product_name: it.productName,
        product_type: "regular",
        quantity: it.quantity,
        unit_cost: it.cost,
        total: lineTotal,
        batch_id: batchId,
        batch_action: action,
      });
      await supabase
        .from("products")
        .update({ stock: Number(prod?.stock ?? 0) + it.quantity, cost_price: it.cost, ...(it.sell > 0 ? { sell_price: it.sell } : {}) })
        .eq("id", it.productId);
    } else {
      // Auto-create new product
      if (it.trackExpiry && !it.expiryDate) throw new Error(`${it.productName} requires an expiry date.`);
      const dbSource = it.newProductSource === "consignment" ? "consignment" : "owned";
      const { data: newProd, error: npErr } = await supabase
        .from("products")
        .insert({
          name: it.productName,
          unit: it.unit || "pcs",
          cost_price: it.cost,
          sell_price: it.sell || 0,
          stock: it.quantity,
          product_source: dbSource,
          consignment_supplier_id: it.newProductSource === "consignment" ? po.supplier_id : null,
          consignment_cost: it.newProductSource === "consignment" ? it.cost : 0,
          track_expiry: it.trackExpiry,
        })
        .select("id")
        .single();
      if (npErr) throw new Error(npErr.message);

      if (it.newProductSource !== "consignment") {
        await supabase.from("batches").insert({
          product_id: newProd.id,
          purchase_id: purchaseId,
          cost_price: it.cost,
          quantity_original: it.quantity,
          quantity_remaining: it.quantity,
          purchase_date: today,
          expiry_date: it.expiryDate,
        });
        await supabase.from("purchase_items").insert({
          purchase_id: purchaseId,
          product_id: newProd.id,
          product_name: it.productName,
          product_type: "regular",
          quantity: it.quantity,
          unit_cost: it.cost,
          total: lineTotal,
          batch_action: "new",
        });
      }
    }
  }

  await supabase.from("purchase_orders").update({ status: "received", received_purchase_id: purchaseId }).eq("id", poId);

  const payNote = `Settled PO ${po.po_number}`;
  if (settlementMethod === "cash_register" && settlementAmount > 0) {
    await logCashEntry(supabase, { type: "withdrawal", amountUsd: -settlementAmount, note: payNote });
    const { data: s2 } = await supabase.from("suppliers").select("balance").eq("id", po.supplier_id).single();
    await supabase.from("suppliers").update({ balance: Number(s2?.balance ?? 0) - settlementAmount }).eq("id", po.supplier_id);
    await supabase
      .from("supplier_ledger")
      .insert({ supplier_id: po.supplier_id, purchase_id: purchaseId, type: "payment", amount: -settlementAmount, note: payNote });
  } else if (settlementMethod === "cash_owner" && settlementAmount > 0) {
    const { data: s2 } = await supabase.from("suppliers").select("balance").eq("id", po.supplier_id).single();
    await supabase.from("suppliers").update({ balance: Number(s2?.balance ?? 0) - settlementAmount }).eq("id", po.supplier_id);
    await supabase
      .from("supplier_ledger")
      .insert({ supplier_id: po.supplier_id, purchase_id: purchaseId, type: "payment", amount: -settlementAmount, note: `Owner cash — ${payNote}` });
  }

  revalidatePath("/purchase-orders");
  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/suppliers");

  return { message: `PO ${po.po_number} received — Purchase #${purchaseId} created and stock updated.` };
}
