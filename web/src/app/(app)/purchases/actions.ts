"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateBatch } from "@/lib/batches";
import { logCashEntry } from "@/lib/cash";
import { getSettings } from "@/lib/settings";
import { fmtUSD } from "@/lib/format";

type PurchaseItemInput = {
  productId: number;
  itemType: "regular" | "consignment";
  quantity: number;
  unitCost: number;
  newSellPrice: number;
  expiryDate: string | null;
};

export async function savePurchase(formData: FormData) {
  const supabase = await createClient();
  let supplierId = Number(formData.get("supplier_id") || 0);
  const paymentMethod = String(formData.get("payment_method") || "pay_later");
  const reference = String(formData.get("reference") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const date = String(formData.get("purchase_date") || new Date().toISOString().slice(0, 10));
  const items: PurchaseItemInput[] = JSON.parse(String(formData.get("items_json") || "[]"));

  if (!items.length) throw new Error("Add at least one item with a valid cost.");

  if (!supplierId) {
    const { data: def } = await supabase.from("suppliers").select("id").eq("name", "Default Supplier").maybeSingle();
    if (def) {
      supplierId = def.id;
    } else {
      const { data: created } = await supabase.from("suppliers").insert({ name: "Default Supplier" }).select("id").single();
      supplierId = created!.id;
    }
  }

  const { data: purchase, error: purchErr } = await supabase
    .from("purchases")
    .insert({ supplier_id: supplierId, reference, total_amount: 0, payment_method: paymentMethod, note, purchase_date: date })
    .select("id")
    .single();
  if (purchErr) throw new Error(purchErr.message);
  const purchaseId = purchase.id;

  let totalDue = 0;
  let totalConsignment = 0;

  for (const item of items) {
    if (!item.productId || item.unitCost <= 0) continue;

    const { data: prod } = await supabase
      .from("products")
      .select("name, sell_price, cost_price, track_expiry")
      .eq("id", item.productId)
      .single();
    if (!prod) continue;

    if (prod.track_expiry && !item.expiryDate) {
      throw new Error(`${prod.name} requires an expiry date for this batch.`);
    }

    const updateSell = item.newSellPrice > 0 ? item.newSellPrice : Number(prod.sell_price);

    if (item.itemType === "consignment") {
      const lineTotal = item.quantity * item.unitCost;
      totalConsignment += lineTotal;

      const { batchId, action } = await findOrCreateBatch(supabase, {
        productId: item.productId,
        purchaseId,
        costPrice: item.unitCost,
        qty: item.quantity,
        purchaseDate: date,
        expiryDate: item.expiryDate,
        trackExpiry: prod.track_expiry,
      });

      await supabase.from("purchase_items").insert({
        purchase_id: purchaseId,
        product_id: item.productId,
        product_name: prod.name,
        product_type: "consignment",
        quantity: item.quantity,
        unit_cost: item.unitCost,
        total: lineTotal,
        batch_id: batchId,
        batch_action: action,
      });

      const { data: current } = await supabase.from("products").select("stock").eq("id", item.productId).single();
      await supabase
        .from("products")
        .update({
          stock: Number(current?.stock ?? 0) + item.quantity,
          consignment_cost: item.unitCost,
          consignment_supplier_id: supplierId,
          product_source: "consignment",
          sell_price: updateSell,
        })
        .eq("id", item.productId);
    } else {
      const lineTotal = item.quantity * item.unitCost;
      totalDue += lineTotal;

      const { batchId, action } = await findOrCreateBatch(supabase, {
        productId: item.productId,
        purchaseId,
        costPrice: item.unitCost,
        qty: item.quantity,
        purchaseDate: date,
        expiryDate: item.expiryDate,
        trackExpiry: prod.track_expiry,
      });

      await supabase.from("purchase_items").insert({
        purchase_id: purchaseId,
        product_id: item.productId,
        product_name: prod.name,
        product_type: "regular",
        quantity: item.quantity,
        unit_cost: item.unitCost,
        total: lineTotal,
        batch_id: batchId,
        batch_action: action,
      });

      const { data: current } = await supabase.from("products").select("stock").eq("id", item.productId).single();
      await supabase
        .from("products")
        .update({
          stock: Number(current?.stock ?? 0) + item.quantity,
          cost_price: item.unitCost,
          sell_price: updateSell,
          product_source: "owned",
        })
        .eq("id", item.productId);
    }
  }

  await supabase.from("purchases").update({ total_amount: totalDue + totalConsignment }).eq("id", purchaseId);

  const { data: supplier } = await supabase.from("suppliers").select("name, balance").eq("id", supplierId).single();
  const purchLabel = `Purchase ${reference ? `#${reference}` : `#${purchaseId}`}${supplier?.name ? ` — ${supplier.name}` : ""}`;

  if (totalDue > 0) {
    await supabase.from("suppliers").update({ balance: Number(supplier?.balance ?? 0) + totalDue }).eq("id", supplierId);
    await supabase.from("supplier_ledger").insert({ supplier_id: supplierId, purchase_id: purchaseId, type: "purchase", amount: totalDue, note: purchLabel });

    const paidNow = paymentMethod === "cash_owner" || paymentMethod === "cash_register";
    if (paidNow) {
      const prefix = paymentMethod === "cash_owner" ? "Owner cash" : "Cash";
      const { data: s2 } = await supabase.from("suppliers").select("balance").eq("id", supplierId).single();
      await supabase.from("suppliers").update({ balance: Number(s2?.balance ?? 0) - totalDue }).eq("id", supplierId);
      await supabase
        .from("supplier_ledger")
        .insert({ supplier_id: supplierId, purchase_id: purchaseId, type: "payment", amount: -totalDue, note: `${prefix} payment — ${purchLabel}` });

      if (paymentMethod === "cash_owner") {
        await logCashEntry(supabase, { type: "deposit", amountUsd: totalDue, note: `Owner cash — ${purchLabel}` });
      } else {
        await logCashEntry(supabase, { type: "withdrawal", amountUsd: -totalDue, note: `Cash USD — ${purchLabel}` });
      }
    }
  }

  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/suppliers");

  const parts: string[] = [];
  if (totalDue > 0) parts.push(`Due ${fmtUSD(totalDue)}`);
  if (totalConsignment > 0) parts.push(`Consignment ${fmtUSD(totalConsignment)} — paid when sold`);
  return { message: `Purchase saved — ${parts.join(" | ") || "no charge"}` };
}

export async function deletePurchase(id: number) {
  const supabase = await createClient();

  const { data: purchase } = await supabase.from("purchases").select("supplier_id, payment_method").eq("id", id).single();
  const payMethod = purchase?.payment_method ?? "pay_later";

  const { data: items } = await supabase.from("purchase_items").select("*").eq("purchase_id", id);
  for (const it of items ?? []) {
    const isStocked = it.product_type === "regular" || it.product_type === "consignment";
    if (isStocked && it.batch_id) {
      const { data: batch } = await supabase.from("batches").select("quantity_remaining, quantity_original").eq("id", it.batch_id).single();
      if (batch) {
        await supabase
          .from("batches")
          .update({
            quantity_remaining: Math.max(0, Number(batch.quantity_remaining) - Number(it.quantity)),
            quantity_original: Math.max(0, Number(batch.quantity_original) - Number(it.quantity)),
          })
          .eq("id", it.batch_id);
      }
    }
    if (isStocked) {
      const { data: prod } = await supabase.from("products").select("stock").eq("id", it.product_id).single();
      if (prod) {
        await supabase
          .from("products")
          .update({ stock: Math.max(0, Number(prod.stock) - Number(it.quantity)) })
          .eq("id", it.product_id);
      }
    }
  }

  if (purchase?.supplier_id) {
    const { data: due } = await supabase
      .from("purchase_items")
      .select("total")
      .eq("purchase_id", id)
      .neq("product_type", "consignment");
    const dueAmount = (due ?? []).reduce((s, r) => s + Number(r.total), 0);

    if (dueAmount > 0) {
      if (payMethod === "pay_later") {
        const { data: s } = await supabase.from("suppliers").select("balance").eq("id", purchase.supplier_id).single();
        await supabase.from("suppliers").update({ balance: Number(s?.balance ?? 0) - dueAmount }).eq("id", purchase.supplier_id);
        await supabase
          .from("supplier_ledger")
          .insert({ supplier_id: purchase.supplier_id, type: "adjustment", amount: -dueAmount, note: `Purchase #${id} deleted (was pending)` });
      } else {
        await supabase
          .from("supplier_ledger")
          .insert({ supplier_id: purchase.supplier_id, type: "adjustment", amount: 0, note: `Purchase #${id} deleted (was paid on receipt)` });
        if (payMethod === "cash_register") {
          await logCashEntry(supabase, { type: "deposit", amountUsd: dueAmount, note: `Reversal — Purchase #${id} deleted` });
        } else if (payMethod === "cash_owner") {
          await logCashEntry(supabase, { type: "withdrawal", amountUsd: -dueAmount, note: `Reversal — Purchase #${id} deleted (owner cash returned)` });
        }
      }
    }
  }

  await supabase.from("purchases").delete().eq("id", id);

  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/suppliers");
}

export async function getPurchaseItems(purchaseId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("purchase_items").select("*").eq("purchase_id", purchaseId);
  return data ?? [];
}
