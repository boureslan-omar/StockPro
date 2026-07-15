"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logCashEntry } from "@/lib/cash";

export async function settleConsignment(formData: FormData) {
  const supabase = await createClient();
  const supplierId = Number(formData.get("supplier_id"));
  const amount = Number(formData.get("amount") || 0);
  const method = String(formData.get("method") || "");
  const note = String(formData.get("note") || "").trim();

  if (!supplierId || amount <= 0) throw new Error("Select a supplier and enter a valid amount.");

  const { data: sup } = await supabase.from("suppliers").select("balance, name").eq("id", supplierId).single();
  if (!sup) throw new Error("Supplier not found.");

  await supabase.from("consignment_settlements").insert({ supplier_id: supplierId, amount_paid: amount, note });

  // The schema has no per-row link between a settlement and specific ledger
  // lines (it's a lump-sum payment log) — so a full payment (amount covers
  // everything currently unsettled) clears the settled flag on those rows;
  // a partial payment still reduces the balance but leaves the per-line
  // "settled" flags as an honest "not fully accounted for yet".
  const { data: unsettledRows } = await supabase
    .from("consignment_ledger")
    .select("supplier_due")
    .eq("supplier_id", supplierId)
    .eq("settled", false);
  const unsettledTotal = (unsettledRows ?? []).reduce((s, r) => s + Number(r.supplier_due), 0);
  if (amount >= unsettledTotal - 0.01) {
    await supabase.from("consignment_ledger").update({ settled: true }).eq("supplier_id", supplierId).eq("settled", false);
  }

  await supabase.from("suppliers").update({ balance: Number(sup.balance) - amount }).eq("id", supplierId);
  await supabase.from("supplier_ledger").insert({
    supplier_id: supplierId,
    type: "payment",
    amount: -amount,
    note: note ? `Consignment settlement — ${note}` : "Consignment settlement",
  });

  if (method === "cash_register" || method === "cash_owner") {
    const prefix = method === "cash_owner" ? "Owner cash" : "Cash";
    await logCashEntry(supabase, {
      type: "withdrawal",
      amountUsd: -amount,
      note: `${prefix} — Consignment settlement (${sup.name})`,
    });
  }

  revalidatePath("/consignments");
  revalidatePath("/suppliers");
  revalidatePath("/cash-register");
  return { message: `Settled $${amount.toFixed(2)} with ${sup.name}.` };
}
