"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deductStockFifo } from "@/lib/stock";
import { logCashEntry } from "@/lib/cash";
import { getSettings } from "@/lib/settings";
import { generateReceiptNo } from "@/lib/receipt";

export type CartLine = {
  productId: number;
  name: string;
  qty: number;
  price: number; // effective unit price actually charged (after any markup)
  type: "regular" | "bulk";
};

export async function processSale(formData: FormData) {
  const supabase = await createClient();
  const cart: CartLine[] = JSON.parse(String(formData.get("cart_json") || "[]"));
  const discount = Number(formData.get("discount") || 0);
  const creditUse = Number(formData.get("credit_use") || 0);
  const paidUsd = Number(formData.get("paid_usd") || 0);
  const paidLbp = Number(formData.get("paid_lbp") || 0);
  const method = String(formData.get("payment_method") || "cash");
  const note = String(formData.get("note") || "").trim();
  const customerId = Number(formData.get("customer_id") || 0) || null;
  const debtPayment = Math.max(0, Number(formData.get("debt_payment") || 0));
  const changeCurrency = String(formData.get("change_currency") || "LBP");

  if (!cart.length) throw new Error("Cart is empty.");

  const settings = await getSettings(supabase);
  const rate = Number(settings.exchange_rate || 89750);

  const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const total = Math.max(0, subtotal - discount - creditUse);
  const totalGiven = paidUsd + paidLbp / rate;
  const changeAmt = Math.max(0, totalGiven - total - debtPayment);
  const changeUsd = changeCurrency === "USD" ? Math.round(changeAmt * 100) / 100 : 0;
  const changeLbp = changeCurrency === "LBP" ? Math.round(changeAmt * rate) : 0;
  const payCur = paidUsd > 0 && paidLbp > 0 ? "BOTH" : paidLbp > 0 ? "LBP" : "USD";

  const receipt = generateReceiptNo();
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .insert({
      receipt_no: receipt,
      customer_id: customerId,
      subtotal,
      discount,
      credit_used: creditUse,
      total,
      paid_usd: paidUsd,
      paid_lbp: paidLbp,
      change_usd: changeUsd,
      change_lbp: changeLbp,
      currency_paid: payCur,
      exchange_rate_used: rate,
      payment_method: method,
      note,
    })
    .select("id")
    .single();
  if (saleErr) throw new Error(saleErr.message);
  const saleId = sale.id;

  for (const item of cart) {
    const { data: prod } = await supabase
      .from("products")
      .select("product_source, consignment_cost, consignment_supplier_id")
      .eq("id", item.productId)
      .single();
    const isConsignment = prod?.product_source === "consignment";

    if (isConsignment) {
      const consCost = Number(prod!.consignment_cost);
      const consSup = prod!.consignment_supplier_id;
      const revenue = Math.round(item.qty * item.price * 100) / 100;
      const supDue = Math.round(item.qty * consCost * 100) / 100;
      const marketCut = Math.round((revenue - supDue) * 100) / 100;

      const { data: p } = await supabase.from("products").select("stock").eq("id", item.productId).single();
      await supabase
        .from("products")
        .update({ stock: Math.max(0, Number(p?.stock ?? 0) - item.qty) })
        .eq("id", item.productId);

      await supabase.from("sale_items").insert({
        sale_id: saleId,
        product_id: item.productId,
        product_name: item.name,
        product_type: item.type,
        is_consignment: true,
        quantity: item.qty,
        unit_price: item.price,
        unit_cost: consCost,
        total: revenue,
      });
      await supabase.from("consignment_ledger").insert({
        sale_id: saleId,
        product_id: item.productId,
        supplier_id: consSup,
        quantity: item.qty,
        sell_price: item.price,
        consignment_cost: consCost,
        revenue,
        supplier_due: supDue,
        market_profit: marketCut,
      });
    } else if (item.type === "bulk") {
      await supabase.from("sale_items").insert({
        sale_id: saleId,
        product_id: item.productId,
        product_name: item.name,
        product_type: "bulk",
        is_consignment: false,
        quantity: item.qty,
        unit_price: item.price,
        unit_cost: 0,
        total: item.qty * item.price,
      });
    } else {
      const unitCost = await deductStockFifo(supabase, item.productId, item.qty);
      await supabase.from("sale_items").insert({
        sale_id: saleId,
        product_id: item.productId,
        product_name: item.name,
        product_type: "regular",
        is_consignment: false,
        quantity: item.qty,
        unit_price: item.price,
        unit_cost: unitCost,
        total: item.qty * item.price,
      });
    }
  }

  if (customerId) {
    const netCashPaid = totalGiven - changeAmt;
    const netBalChange = total + creditUse - netCashPaid;
    if (Math.abs(netBalChange) > 0.001) {
      const { data: cust } = await supabase.from("customers").select("balance").eq("id", customerId).single();
      await supabase.from("customers").update({ balance: Number(cust?.balance ?? 0) - netBalChange }).eq("id", customerId);
    }

    await supabase.from("customer_ledger").insert({
      customer_id: customerId,
      sale_id: saleId,
      type: "sale",
      amount: -total,
      note: `Sale #${receipt} — Total: $${total.toFixed(2)}`,
    });
    if (creditUse > 0) {
      await supabase.from("customer_ledger").insert({
        customer_id: customerId,
        sale_id: saleId,
        type: "payment",
        amount: creditUse,
        note: `Store credit applied — #${receipt}`,
      });
    }
    const cashForSale = netCashPaid - debtPayment;
    if (cashForSale > 0.001) {
      await supabase.from("customer_ledger").insert({
        customer_id: customerId,
        sale_id: saleId,
        type: "payment",
        amount: cashForSale,
        note: `Payment for #${receipt}`,
      });
    }
    if (debtPayment > 0.001) {
      await supabase.from("customer_ledger").insert({
        customer_id: customerId,
        sale_id: saleId,
        type: "payment",
        amount: debtPayment,
        note: `Debt settlement — #${receipt}`,
      });
    }

    for (const item of cart) {
      if (item.type === "bulk" || item.price <= 0) continue;
      await supabase
        .from("customer_prices")
        .upsert({ customer_id: customerId, product_id: item.productId, last_price: item.price }, { onConflict: "customer_id,product_id" });
    }
  }

  const netUsd = paidUsd - changeUsd;
  const netLbp = paidLbp - changeLbp;
  if (Math.abs(netUsd) > 0.001 || Math.abs(netLbp) > 0.001) {
    const cur = netUsd !== 0 && netLbp !== 0 ? "BOTH" : netLbp !== 0 ? "LBP" : "USD";
    await logCashEntry(supabase, { type: "sale", amountUsd: netUsd, amountLbp: netLbp, note: `Sale #${receipt}`, saleId, currency: cur });
  }

  revalidatePath("/pos");
  revalidatePath("/products");
  revalidatePath("/customers");
  revalidatePath("/cash-register");

  return { saleId, receipt };
}

// "Memory mode": the last price actually charged to this customer for each
// product (customer_prices is upserted at the end of processSale below).
export async function getCustomerPrices(customerId: number): Promise<Record<number, number>> {
  if (!customerId) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("customer_prices").select("product_id, last_price").eq("customer_id", customerId);
  const map: Record<number, number> = {};
  for (const row of data ?? []) map[row.product_id] = Number(row.last_price);
  return map;
}

export async function getReceiptData(saleId: number) {
  const supabase = await createClient();
  const { data: sale } = await supabase.from("sales").select("*, customers(name)").eq("id", saleId).single();
  const { data: items } = await supabase.from("sale_items").select("*, products(units_per_box)").eq("sale_id", saleId);
  const settings = await getSettings(supabase);
  return { sale, items: items ?? [], settings };
}
